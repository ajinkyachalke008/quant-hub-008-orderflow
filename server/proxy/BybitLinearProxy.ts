/**
 * BybitLinearProxy — server-side WebSocket relay for Bybit USDT perpetuals.
 *
 * Subscribes to publicTrade / orderbook.25 / liquidation for one symbol and
 * fans normalized data out to N browser clients over Server-Sent Events.
 * Parsing/normalization mirrors src/services/adapters/BybitLinearAdapter.ts.
 */
import WebSocket from 'ws';
import type { ServerResponse } from 'http';
import type {
  FeedState,
  NormalizedTrade,
  NormalizedDepth,
  NormalizedLiquidation,
  BookLevel,
} from '../../src/types/orderFlow';

const BASE_URL = 'wss://stream.bybit.com/v5/public/linear';
const DEFAULT_SYMBOL = 'BTCUSDT';
const BACKOFF_MS: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
const HEARTBEAT_MS = 20000;
const PONG_TIMEOUT_MS = 10000;
const TRADE_FLUSH_MS = 50;
const IDLE_DISCONNECT_MS = 30000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Snapshot/delta order book assembly, copied from the client adapter. */
export class BybitOrderBookState {
  private bids: Map<number, number> = new Map();
  private asks: Map<number, number> = new Map();
  private seq: number = 0;

  public applySnapshot(b: Array<[string, string]>, a: Array<[string, string]>): void {
    this.bids.clear();
    this.asks.clear();
    for (const [p, s] of b) {
      const price = Number(p);
      const size = Number(s);
      if (Number.isFinite(price) && Number.isFinite(size) && size > 0) this.bids.set(price, size);
    }
    for (const [p, s] of a) {
      const price = Number(p);
      const size = Number(s);
      if (Number.isFinite(price) && Number.isFinite(size) && size > 0) this.asks.set(price, size);
    }
  }

  public applyDelta(b: Array<[string, string]>, a: Array<[string, string]>): void {
    for (const [p, s] of b) {
      const price = Number(p);
      const size = Number(s);
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
      if (size === 0) this.bids.delete(price);
      else this.bids.set(price, size);
    }
    for (const [p, s] of a) {
      const price = Number(p);
      const size = Number(s);
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
      if (size === 0) this.asks.delete(price);
      else this.asks.set(price, size);
    }
  }

  public setSeq(seq: number): void {
    this.seq = seq;
  }

  public getSeq(): number {
    return this.seq;
  }

  public toLevels(): { bids: BookLevel[]; asks: BookLevel[] } {
    const bids: BookLevel[] = [];
    for (const [price, qty] of this.bids) bids.push({ price, qty });
    const asks: BookLevel[] = [];
    for (const [price, qty] of this.asks) asks.push({ price, qty });
    bids.sort((x, y) => y.price - x.price);
    asks.sort((x, y) => x.price - y.price);
    return { bids, asks };
  }
}

export type SSEClient = {
  id: string;
  res: ServerResponse;
};

export class BybitLinearProxy {
  private ws: WebSocket | null = null;
  private status: FeedState = 'CONNECTING';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex = 0;
  private manuallyClosed = false;
  private clients: Map<string, SSEClient> = new Map();
  private symbol: string;
  private orderbook: BybitOrderBookState = new BybitOrderBookState();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private tradeBuffer: NormalizedTrade[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(symbol: string = DEFAULT_SYMBOL) {
    this.symbol = symbol.toUpperCase();
  }

  public getSymbol(): string {
    return this.symbol;
  }

  public getStatus(): FeedState {
    return this.status;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public connect(): void {
    this.disconnect();
    this.manuallyClosed = false;
    this.status = 'CONNECTING';
    this.backoffIndex = 0;
    this.orderbook = new BybitOrderBookState();
    this.startFlushTimer();

    try {
      this.ws = new WebSocket(BASE_URL);

      this.ws.on('open', () => {
        this.backoffIndex = 0;
        this.status = 'CONNECTING';
        // Subscribe one topic at a time: Bybit rejects a whole subscribe batch
        // when any single topic is unknown, so one bad topic must not cost us
        // the feeds that are valid.
        const topics = [
          `publicTrade.${this.symbol}`,
          `orderbook.50.${this.symbol}`,
          `allLiquidation.${this.symbol}`,
        ];
        for (const topic of topics) {
          this.safeSend(JSON.stringify({ op: 'subscribe', args: [topic] }));
        }
        this.startHeartbeat();
        this.broadcastStatus();
      });

      this.ws.on('message', (raw: WebSocket.RawData) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          return;
        }
        try {
          this.handleMessage(parsed);
        } catch {
          /* never let a bad message kill the feed */
        }
      });

      this.ws.on('close', () => {
        this.stopHeartbeat();
        if (this.manuallyClosed) return;
        this.status = 'RECONNECTING';
        this.broadcastStatus();
        this.scheduleReconnect();
      });

      this.ws.on('error', () => {
        if (this.manuallyClosed) return;
        this.status = 'RECONNECTING';
        this.broadcastStatus();
      });
    } catch {
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    }

    this.broadcastStatus();
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.tradeBuffer = [];
    if (this.ws !== null) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.status = 'DISCONNECTED';
  }

  public addClient(id: string, res: ServerResponse): void {
    this.clients.set(id, { id, res });
    this.resetIdleTimer();
    this.send(res, { type: 'status', status: this.status, symbol: this.symbol });
  }

  public removeClient(id: string): void {
    this.clients.delete(id);
    if (this.clients.size === 0) this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.clients.size === 0) {
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        if (this.clients.size === 0) this.disconnect();
      }, IDLE_DISCONNECT_MS);
    }
  }

  private safeSend(payload: string): void {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(payload);
    } catch {
      /* socket closing */
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.safeSend(JSON.stringify({ op: 'ping' }));
      if (this.pongTimer !== null) clearTimeout(this.pongTimer);
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null;
        try {
          this.ws?.close();
        } catch {
          /* ignore */
        }
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setInterval(() => this.flushTradeBuffer(), TRADE_FLUSH_MS);
  }

  private flushTradeBuffer(): void {
    if (this.tradeBuffer.length === 0) return;
    const batch = this.tradeBuffer;
    this.tradeBuffer = [];
    this.broadcast({ type: 'trades', trades: batch });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = BACKOFF_MS[Math.min(this.backoffIndex, BACKOFF_MS.length - 1)];
    this.backoffIndex = Math.min(this.backoffIndex + 1, BACKOFF_MS.length - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed) this.connect();
    }, delay);
  }

  private handleMessage(parsed: unknown): void {
    if (!isPlainObject(parsed)) return;
    const obj = parsed as Record<string, unknown>;
    // Bybit answers a ping with {"op":"pong"}; some deployments answer
    // {"op":"ping","ret_msg":"pong"}. Accept both so a healthy socket is never
    // torn down by the pong timeout.
    if (obj['op'] === 'pong' || obj['ret_msg'] === 'pong') {
      if (this.pongTimer !== null) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
      return;
    }
    if (obj['success'] === false) {
      // A rejected subscription means the upstream config is wrong. Surface it
      // instead of letting the feed look healthy.
      const reason = typeof obj['ret_msg'] === 'string' ? obj['ret_msg'] : 'subscribe rejected';
      console.warn(`[BybitLinearProxy] ${this.symbol} subscribe rejected: ${reason}`);
      if (this.status !== 'ERROR') {
        this.status = 'ERROR';
        this.broadcastStatus();
      }
      return;
    }
    if (obj['success'] === true && typeof obj['op'] === 'string') {
      return;
    }
    const topic = obj['topic'];
    if (typeof topic !== 'string') return;
    const type = obj['type'];
    const data = obj['data'];

    if (topic.startsWith('publicTrade.')) {
      this.handleTrade(data);
    } else if (topic.startsWith('orderbook.')) {
      if (type === 'snapshot') this.handleSnapshot(data, obj['seq']);
      else if (type === 'delta') this.handleDelta(data, obj['seq']);
    } else if (topic.startsWith('allLiquidation.') || topic.startsWith('liquidation.')) {
      this.handleLiquidation(data);
    }
  }

  private setLive(): void {
    if (this.status === 'LIVE') return;
    this.status = 'LIVE';
    this.broadcastStatus();
  }

  private handleTrade(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (!isPlainObject(item)) continue;
      const o = item as Record<string, unknown>;
      const p = toNum(o['p']);
      const v = toNum(o['v']);
      const T = toNum(o['T']);
      const i = o['i'];
      const S = o['S'];
      const s = o['s'] ?? this.symbol;
      if (p === null || v === null || T === null) continue;
      if (typeof S !== 'string') continue;
      this.tradeBuffer.push({
        exchange: 'bybit-linear',
        symbol: String(s).toUpperCase(),
        tradeId: String(i),
        price: p,
        qty: v,
        quoteQty: p * v,
        side: S === 'Buy' ? 'buy' : 'sell',
        timestamp: T,
      });
    }
    this.setLive();
  }

  private handleSnapshot(data: unknown, seq: unknown): void {
    if (!isPlainObject(data)) return;
    const o = data as Record<string, unknown>;
    const b = o['b'];
    const a = o['a'];
    if (!Array.isArray(b) || !Array.isArray(a)) return;
    this.orderbook.applySnapshot(b as Array<[string, string]>, a as Array<[string, string]>);
    const seqNum = toNum(seq);
    if (seqNum !== null) this.orderbook.setSeq(seqNum);
    this.emitDepth();
    this.setLive();
  }

  private handleDelta(data: unknown, seq: unknown): void {
    if (!isPlainObject(data)) return;
    const o = data as Record<string, unknown>;
    const b = o['b'];
    const a = o['a'];
    const bids = Array.isArray(b) ? (b as Array<[string, string]>) : [];
    const asks = Array.isArray(a) ? (a as Array<[string, string]>) : [];
    this.orderbook.applyDelta(bids, asks);
    const seqNum = toNum(seq);
    if (seqNum !== null) this.orderbook.setSeq(seqNum);
    this.emitDepth();
  }

  private emitDepth(): void {
    const { bids, asks } = this.orderbook.toLevels();
    const depth: NormalizedDepth = {
      exchange: 'bybit-linear',
      symbol: this.symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
    this.broadcast({ type: 'depth', depth });
  }

  private handleLiquidation(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (!isPlainObject(item)) continue;
      const o = item as Record<string, unknown>;
      // allLiquidation sends S/p/v/T; the older liquidation topic used
      // side/price/size/updatedTime. Accept both shapes.
      const side = o['S'] ?? o['side'];
      const size = toNum(o['v'] ?? o['size']);
      const price = toNum(o['p'] ?? o['price']);
      const T = toNum(o['T'] ?? o['updatedTime']);
      const s = o['s'] ?? o['symbol'] ?? this.symbol;
      if (typeof side !== 'string' || size === null || price === null) continue;
      const liq: NormalizedLiquidation = {
        exchange: 'bybit-linear',
        symbol: String(s).toUpperCase(),
        t: T ?? Date.now(),
        price,
        usd: price * size,
        long: side === 'Sell',
      };
      this.broadcast({ type: 'liquidation', liquidation: liq });
    }
    this.setLive();
  }

  private broadcastStatus(): void {
    this.broadcast({ type: 'status', status: this.status, symbol: this.symbol });
  }

  private send(res: ServerResponse, payload: unknown): void {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      /* client socket already gone */
    }
  }

  private broadcast(payload: unknown): void {
    if (this.clients.size === 0) return;
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients) {
      try {
        client.res.write(frame);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}

export default BybitLinearProxy;