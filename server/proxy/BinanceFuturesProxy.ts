/**
 * BinanceFuturesProxy — server-side WebSocket relay for Binance USD-M Futures.
 *
 * Connects once per symbol to wss://fstream.binance.com/stream and fans the
 * normalized data out to N browser clients over Server-Sent Events.
 *
 * Normalization mirrors src/services/adapters/BinanceFuturesAdapter.ts with two
 * corrections:
 *  - the depth payload carries bids/asks in `b` / `a` (the client adapter only
 *    reads `bids` / `asks`, which Binance never sends);
 *  - LIVE is gated on the order-flow essentials (aggTrade + depth). markPrice
 *    and forceOrder are sparse/best-effort and must not hold the feed back.
 *
 * A socket that opens but never delivers a required stream is a silent
 * failure, so a watchdog rotates to the next base URL and finally reports
 * STALE rather than reconnecting forever.
 */
import WebSocket from 'ws';
import type { ServerResponse } from 'http';
import type {
  FeedState,
  NormalizedTrade,
  NormalizedDepth,
  NormalizedLiquidation,
  NormalizedMarkPrice,
  BookLevel,
} from '../../src/types/orderFlow';

// Primary first; the read-only market data mirror is the fallback used when the
// primary accepts the socket but never delivers a frame (blocked route/region).
const BASE_URLS = [
  'wss://fstream.binance.com/stream',
  'wss://data-stream.binance.vision/stream',
];
const DEFAULT_SYMBOL = 'BTCUSDT';
const BACKOFF_MS: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
const TRADE_FLUSH_MS = 50;
const IDLE_DISCONNECT_MS = 30000;
const NO_DATA_TIMEOUT_MS = 15000;
const AGGTRADE_STALL_MS = 10000;
const WATCHDOG_INTERVAL_MS = 5000;

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toSide(maker: unknown): 'buy' | 'sell' {
  return maker === false ? 'buy' : 'sell';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isEnvelope(v: unknown): v is { stream: string; data: unknown } {
  if (!isPlainObject(v)) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj['stream'] === 'string' && 'data' in obj;
}

function parseAggTrade(data: unknown): NormalizedTrade | null {
  if (!isPlainObject(data)) return null;
  const obj = data as Record<string, unknown>;
  const p = toNum(obj['p']);
  const q = toNum(obj['q']);
  const a = obj['a'];
  const T = toNum(obj['T']);
  const m = obj['m'];
  const s = obj['s'];
  if (p === null || q === null || T === null) return null;
  if (typeof a !== 'string' && typeof a !== 'number') return null;
  if (typeof s !== 'string') return null;
  return {
    exchange: 'binance-futures',
    symbol: s.toUpperCase(),
    tradeId: String(a),
    price: p,
    qty: q,
    quoteQty: p * q,
    side: toSide(m),
    timestamp: T,
  };
}

function parseLevels(raw: unknown): BookLevel[] | null {
  if (!Array.isArray(raw)) return null;
  const out: BookLevel[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const price = toNum(entry[0]);
    const qty = toNum(entry[1]);
    if (price === null || qty === null) continue;
    out.push({ price, qty });
  }
  return out;
}

function parseDepth(data: unknown): NormalizedDepth | null {
  if (!isPlainObject(data)) return null;
  const obj = data as Record<string, unknown>;
  const s = obj['s'];
  // Binance sends the book in `b` / `a`; `bids` / `asks` is tolerated for
  // compatibility with the shape the client adapter assumed.
  const bidsRaw = obj['b'] ?? obj['bids'];
  const asksRaw = obj['a'] ?? obj['asks'];
  const T = toNum(obj['T'] ?? obj['E']);
  if (typeof s !== 'string' || T === null) return null;
  const bids = parseLevels(bidsRaw);
  const asks = parseLevels(asksRaw);
  if (bids === null || asks === null) return null;
  return {
    exchange: 'binance-futures',
    symbol: s.toUpperCase(),
    bids,
    asks,
    timestamp: T,
  };
}

function parseLiquidation(data: unknown): NormalizedLiquidation | null {
  if (!isPlainObject(data)) return null;
  const obj = data as Record<string, unknown>;
  const o = obj['o'];
  if (!isPlainObject(o)) return null;
  const ord = o as Record<string, unknown>;
  const S = ord['S'];
  const p = toNum(ord['p']);
  const q = toNum(ord['q']);
  const ap = toNum(ord['ap']);
  const T = toNum(ord['T']);
  const s = ord['s'];
  if (typeof S !== 'string' || p === null || q === null || ap === null || T === null || typeof s !== 'string') {
    return null;
  }
  return {
    exchange: 'binance-futures',
    symbol: s.toUpperCase(),
    t: T,
    price: p,
    usd: ap * q,
    long: S === 'SELL',
  };
}

function parseMarkPrice(data: unknown): NormalizedMarkPrice | null {
  if (!isPlainObject(data)) return null;
  const obj = data as Record<string, unknown>;
  const s = obj['s'];
  const mark = toNum(obj['p']);
  const index = toNum(obj['i']);
  const funding = toNum(obj['r']);
  const nextFunding = toNum(obj['T']);
  const E = toNum(obj['E']);
  if (
    typeof s !== 'string' ||
    mark === null ||
    index === null ||
    funding === null ||
    nextFunding === null ||
    E === null
  ) {
    return null;
  }
  return {
    symbol: s.toUpperCase(),
    markPrice: mark,
    indexPrice: index,
    fundingRate: funding,
    nextFundingTime: nextFunding,
    timestamp: E,
  };
}

export type SSEClient = {
  id: string;
  res: ServerResponse;
};

export class BinanceFuturesProxy {
  private ws: WebSocket | null = null;
  private status: FeedState = 'CONNECTING';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex = 0;
  private streamsLive = new Set<string>();
  private lastStreamTime: Map<string, number> = new Map();
  private manuallyClosed = false;
  private clients: Map<string, SSEClient> = new Map();
  private symbol: string;
  private tradeBuffer: NormalizedTrade[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageTime = 0;
  private hostIndex = 0;
  private readonly aggTradeStream: string;
  private readonly depthStream: string;
  private readonly expectedStreams: string[];

  constructor(symbol: string = DEFAULT_SYMBOL) {
    this.symbol = symbol.toLowerCase();
    const sym = this.symbol;
    this.aggTradeStream = `${sym}@aggTrade`;
    this.depthStream = `${sym}@depth20@100ms`;
    this.expectedStreams = [
      this.aggTradeStream,
      this.depthStream,
      '!forceOrder@arr',
      `${sym}@markPrice@1s`,
    ];
  }

  public getSymbol(): string {
    return this.symbol.toUpperCase();
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
    this.streamsLive = new Set();
    this.lastStreamTime = new Map();
    this.backoffIndex = 0;
    this.lastMessageTime = Date.now();
    this.startFlushTimer();
    this.startWatchdog();

    const base = BASE_URLS[Math.min(this.hostIndex, BASE_URLS.length - 1)];
    const url = `${base}?streams=${this.expectedStreams.join('/')}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.backoffIndex = 0;
      });

      this.ws.on('message', (raw: WebSocket.RawData) => {
        this.lastMessageTime = Date.now();
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          return;
        }
        try {
          this.handleEnvelope(parsed);
        } catch {
          /* never let a bad message kill the feed */
        }
      });

      this.ws.on('close', () => {
        if (this.manuallyClosed) return;
        this.status = 'RECONNECTING';
        this.broadcastStatus();
        this.scheduleReconnect();
      });

      this.ws.on('error', () => {
        if (this.manuallyClosed) return;
        this.status = 'RECONNECTING';
        this.broadcastStatus();
        this.scheduleReconnect();
      });
    } catch {
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    }

    this.broadcastStatus();
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.watchdogTimer !== null) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
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
    this.streamsLive = new Set();
  }

  public addClient(id: string, res: ServerResponse): void {
    this.clients.set(id, { id, res });
    this.resetIdleTimer();
    this.send(res, { type: 'status', status: this.status, symbol: this.symbol.toUpperCase() });
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

  /**
   * Detects a socket that is open but not delivering the order-flow essentials:
   * rotate to the next base URL while one remains, then report STALE/DELAYED
   * instead of reconnecting forever.
   */
  private startWatchdog(): void {
    if (this.watchdogTimer !== null) return;
    this.watchdogTimer = setInterval(() => {
      if (this.manuallyClosed) return;
      const now = Date.now();
      const silentMs = now - this.lastMessageTime;
      const aggTradeAge = now - (this.lastStreamTime.get(this.aggTradeStream) ?? 0);

      let unhealthy = silentMs > NO_DATA_TIMEOUT_MS;
      let reason: FeedState = 'STALE';
      if (!unhealthy && aggTradeAge > AGGTRADE_STALL_MS) {
        unhealthy = true;
        reason = 'DELAYED';
      }
      if (!unhealthy) return;

      if (this.hostIndex < BASE_URLS.length - 1) {
        this.hostIndex += 1;
        this.status = 'RECONNECTING';
        this.broadcastStatus();
        this.scheduleReconnect();
        const ws = this.ws;
        this.ws = null;
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
        return;
      }

      if (this.status === 'LIVE' || this.status === 'CONNECTING') {
        this.status = reason;
        this.broadcastStatus();
      }
    }, WATCHDOG_INTERVAL_MS);
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

  private handleEnvelope(envelope: unknown): void {
    if (!isEnvelope(envelope)) return;
    const { stream, data } = envelope;
    if (typeof stream !== 'string') return;
    this.lastStreamTime.set(stream, Date.now());

    if (stream.endsWith('@aggTrade')) {
      const t = parseAggTrade(data);
      if (t) this.tradeBuffer.push(t);
      this.markStreamLive(stream);
    } else if (stream.endsWith('@depth20@100ms')) {
      const d = parseDepth(data);
      if (d) this.broadcast({ type: 'depth', depth: d });
      this.markStreamLive(stream);
    } else if (stream === '!forceOrder@arr') {
      const l = parseLiquidation(data);
      if (l && l.symbol.toUpperCase() === this.symbol.toUpperCase()) {
        this.broadcast({ type: 'liquidation', liquidation: l });
      }
      this.markStreamLive(stream);
    } else if (stream.endsWith('@markPrice@1s')) {
      const m = parseMarkPrice(data);
      if (m) this.broadcast({ type: 'markPrice', markPrice: m });
      this.markStreamLive(stream);
    }
  }

  private markStreamLive(stream: string): void {
    const before = this.status;
    this.streamsLive.add(stream);
    // aggTrade + depth are the order-flow essentials; markPrice and forceOrder
    // are sparse by nature and must not gate LIVE.
    if (this.streamsLive.has(this.aggTradeStream) && this.streamsLive.has(this.depthStream)) {
      this.status = 'LIVE';
    }
    if (before !== this.status) this.broadcastStatus();
  }

  private broadcastStatus(): void {
    this.broadcast({ type: 'status', status: this.status, symbol: this.symbol.toUpperCase() });
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

export default BinanceFuturesProxy;