import {
  FeedState,
  NormalizedTrade,
  NormalizedDepth,
  NormalizedLiquidation,
  NormalizedMarkPrice,
  BookLevel,
} from '../../types/orderFlow';

export interface IExchangeAdapter {
  connect(): void;
  disconnect(): void;
  getStatus(): FeedState;
  onTrade(cb: (t: NormalizedTrade) => void): void;
  onDepth(cb: (d: NormalizedDepth) => void): void;
  onLiquidation(cb: (l: NormalizedLiquidation) => void): void;
  onMarkPrice(cb: (m: NormalizedMarkPrice) => void): void;
}

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

  public setSeq(seq: number): void { this.seq = seq; }
  public getSeq(): number { return this.seq; }

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

const BASE_URL = 'wss://stream.bybit.com/v5/public/linear';
const DEFAULT_SYMBOL = 'BTCUSDT';
const BACKOFF_MS: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
const HEARTBEAT_MS = 20000;
const PONG_TIMEOUT_MS = 10000;

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

interface StreamHandlers {
  onTrade?: (t: NormalizedTrade) => void;
  onDepth?: (d: NormalizedDepth) => void;
  onLiquidation?: (l: NormalizedLiquidation) => void;
  onMarkPrice?: (m: NormalizedMarkPrice) => void;
}

export class BybitLinearAdapter implements IExchangeAdapter {
  private symbol: string;
  private ws: WebSocket | null = null;
  private status: FeedState = 'CONNECTING';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex: number = 0;
  private manuallyClosed: boolean = false;
  private handlers: StreamHandlers = {};
  private orderbook: BybitOrderBookState = new BybitOrderBookState();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(symbol: string = DEFAULT_SYMBOL) {
    this.symbol = symbol.toUpperCase();
  }

  public connect(): void {
    this.disconnect();
    this.manuallyClosed = false;
    this.status = 'CONNECTING';
    this.backoffIndex = 0;
    this.orderbook = new BybitOrderBookState();

    this.ws = new WebSocket(BASE_URL);

    this.ws.onopen = () => {
      this.backoffIndex = 0;
      this.status = 'CONNECTING';
      const sub = { op: 'subscribe', args: [`publicTrade.${this.symbol}`, `orderbook.25.${this.symbol}`, `liquidation.${this.symbol}`] };
      this.ws?.send(JSON.stringify(sub));
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        console.debug('[BybitLinearAdapter] malformed message dropped');
        return;
      }
      this.handleMessage(parsed);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.manuallyClosed) return;
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      if (this.manuallyClosed) return;
      this.status = 'RECONNECTING';
    };
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws !== null) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'DISCONNECTED';
  }

  public getStatus(): FeedState { return this.status; }

  public onTrade(cb: (t: NormalizedTrade) => void): void { this.handlers.onTrade = cb; }
  public onDepth(cb: (d: NormalizedDepth) => void): void { this.handlers.onDepth = cb; }
  public onLiquidation(cb: (l: NormalizedLiquidation) => void): void { this.handlers.onLiquidation = cb; }
  public onMarkPrice(cb: (m: NormalizedMarkPrice) => void): void { this.handlers.onMarkPrice = cb; }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
        this.pongTimer = setTimeout(() => {
          if (this.ws) { this.ws.close(); }
        }, PONG_TIMEOUT_MS);
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.pongTimer !== null) { clearTimeout(this.pongTimer); this.pongTimer = null; }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = BACKOFF_MS[Math.min(this.backoffIndex, BACKOFF_MS.length - 1)];
    this.backoffIndex = Math.min(this.backoffIndex + 1, BACKOFF_MS.length - 1);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleMessage(parsed: unknown): void {
    if (!isPlainObject(parsed)) return;
    const obj = parsed as Record<string, unknown>;
    if (obj['op'] === 'pong') {
      if (this.pongTimer !== null) { clearTimeout(this.pongTimer); this.pongTimer = null; }
      return;
    }
    if (obj['success'] === true && typeof obj['op'] === 'string') {
      this.status = 'LIVE';
      return;
    }
    const topic = obj['topic'];
    if (typeof topic !== 'string') return;
    const type = obj['type'];
    const data = obj['data'];

    if (topic.startsWith('publicTrade.')) {
      this.handleTrade(data);
    } else if (topic.startsWith('orderbook.')) {
      if (type === 'snapshot') {
        this.handleSnapshot(data, obj['seq']);
      } else if (type === 'delta') {
        this.handleDelta(data, obj['seq']);
      }
    } else if (topic.startsWith('liquidation.')) {
      this.handleLiquidation(data);
    }
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
      const trade: NormalizedTrade = {
        exchange: 'bybit-linear',
        symbol: String(s).toUpperCase(),
        tradeId: String(i),
        price: p,
        qty: v,
        quoteQty: p * v,
        side: S === 'Buy' ? 'buy' : 'sell',
        timestamp: T,
      };
      const cb = this.handlers.onTrade;
      if (cb) cb(trade);
    }
    this.status = 'LIVE';
  }

  private handleSnapshot(data: unknown, seq: unknown): void {
    if (!isPlainObject(data)) return;
    const o = data as Record<string, unknown>;
    const b = o['b'];
    const a = o['a'];
    if (!Array.isArray(b) || !Array.isArray(a)) return;
    const bids = b as Array<[string, string]>;
    const asks = a as Array<[string, string]>;
    this.orderbook.applySnapshot(bids, asks);
    const seqNum = toNum(seq);
    if (seqNum !== null) this.orderbook.setSeq(seqNum);
    this.emitDepth();
    this.status = 'LIVE';
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
    const cb = this.handlers.onDepth;
    if (cb) cb(depth);
  }

  private handleLiquidation(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (!isPlainObject(item)) continue;
      const o = item as Record<string, unknown>;
      const side = o['side'];
      const size = toNum(o['size']);
      const price = toNum(o['price']);
      const T = toNum(o['updatedTime']);
      const s = o['symbol'] ?? this.symbol;
      if (typeof side !== 'string' || size === null || price === null) continue;
      const liq: NormalizedLiquidation = {
        exchange: 'bybit-linear',
        symbol: String(s).toUpperCase(),
        t: T ?? Date.now(),
        price,
        usd: price * size,
        long: side === 'Sell',
      };
      const cb = this.handlers.onLiquidation;
      if (cb) cb(liq);
    }
    this.status = 'LIVE';
  }
}
