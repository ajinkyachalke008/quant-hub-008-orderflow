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

const BASE_URL = 'wss://fstream.binance.com/stream';
const DEFAULT_SYMBOL = 'BTCUSDT';
const BACKOFF_MS: number[] = [1000, 2000, 4000, 8000, 16000, 30000];
const STALE_MS = 45000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

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

interface StreamHandlers {
  onTrade?: (t: NormalizedTrade) => void;
  onDepth?: (d: NormalizedDepth) => void;
  onLiquidation?: (l: NormalizedLiquidation) => void;
  onMarkPrice?: (m: NormalizedMarkPrice) => void;
}

export class BinanceFuturesAdapter implements IExchangeAdapter {
  private symbol: string;
  private ws: WebSocket | null = null;
  private status: FeedState = 'CONNECTING';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex: number = 0;
  private lastMessageTime: number = 0;
  private streamsLive: Set<string> = new Set();
  private manuallyClosed: boolean = false;
  private handlers: StreamHandlers = {};

  private readonly expectedStreams: string[];

  constructor(symbol: string = DEFAULT_SYMBOL) {
    this.symbol = symbol.toLowerCase();
    const sym = this.symbol;
    this.expectedStreams = [
      `${sym}@aggTrade`,
      `${sym}@depth20@100ms`,
      '!forceOrder@arr',
      `${sym}@markPrice@1s`,
    ];
  }

  public connect(): void {
    this.disconnect();
    this.manuallyClosed = false;
    this.status = 'CONNECTING';
    this.streamsLive = new Set();
    this.backoffIndex = 0;
    this.lastMessageTime = Date.now();

    const url = `${BASE_URL}?streams=${this.expectedStreams.join('/')}`;
    console.info('[BinanceFuturesAdapter] connecting', this.symbol);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.backoffIndex = 0;
      console.info('[BinanceFuturesAdapter] connected', this.symbol);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.lastMessageTime = Date.now();
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        console.debug('[BinanceFuturesAdapter] malformed message dropped');
        return;
      }
      this.handleEnvelope(parsed);
    };

    this.ws.onclose = () => {
      if (this.manuallyClosed) return;
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      if (this.manuallyClosed) return;
      this.status = 'RECONNECTING';
      this.scheduleReconnect();
    };
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws !== null) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'DISCONNECTED';
    this.streamsLive = new Set();
    console.info('[BinanceFuturesAdapter] disconnected', this.symbol);
  }

  public getStatus(): FeedState {
    return this.status;
  }

  public isStale(): boolean {
    return Date.now() - this.lastMessageTime > STALE_MS;
  }

  public onTrade(cb: (t: NormalizedTrade) => void): void {
    this.handlers.onTrade = cb;
  }

  public onDepth(cb: (d: NormalizedDepth) => void): void {
    this.handlers.onDepth = cb;
  }

  public onLiquidation(cb: (l: NormalizedLiquidation) => void): void {
    this.handlers.onLiquidation = cb;
  }

  public onMarkPrice(cb: (m: NormalizedMarkPrice) => void): void {
    this.handlers.onMarkPrice = cb;
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

  private handleEnvelope(envelope: unknown): void {
    if (!this.isEnvelope(envelope)) return;
    const { stream, data } = envelope;
    if (typeof stream !== 'string') return;

    if (stream.endsWith('@aggTrade')) {
      this.handleAggTrade(data);
      this.markStreamLive(stream);
    } else if (stream.endsWith('@depth20@100ms')) {
      this.handleDepth(data);
      this.markStreamLive(stream);
    } else if (stream === '!forceOrder@arr') {
      this.handleLiquidation(data);
      this.markStreamLive(stream);
    } else if (stream.endsWith('@markPrice@1s')) {
      this.handleMarkPrice(data);
      this.markStreamLive(stream);
    }
  }

  private markStreamLive(stream: string): void {
    this.streamsLive.add(stream);
    if (this.streamsLive.size >= this.expectedStreams.length) {
      this.status = 'LIVE';
    }
  }

  private handleAggTrade(data: unknown): void {
    const t = this.parseAggTrade(data);
    if (!t) return;
    const cb = this.handlers.onTrade;
    if (cb) cb(t);
  }

  private parseAggTrade(data: unknown): NormalizedTrade | null {
    if (!this.isPlainObject(data)) return null;
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
    const tradeId = String(a);
    const side = toSide(m);
    return {
      exchange: 'binance-futures',
      symbol: s.toUpperCase(),
      tradeId,
      price: p,
      qty: q,
      quoteQty: p * q,
      side,
      timestamp: T,
    };
  }

  private handleDepth(data: unknown): void {
    const d = this.parseDepth(data);
    if (!d) return;
    const cb = this.handlers.onDepth;
    if (cb) cb(d);
  }

  private parseDepth(data: unknown): NormalizedDepth | null {
    if (!this.isPlainObject(data)) return null;
    const obj = data as Record<string, unknown>;
    const s = obj['s'];
    const bidsRaw = obj['bids'];
    const asksRaw = obj['asks'];
    const T = toNum(obj['T'] ?? obj['E']);
    if (typeof s !== 'string' || T === null) return null;
    const bids = this.parseLevels(bidsRaw);
    const asks = this.parseLevels(asksRaw);
    if (bids === null || asks === null) return null;
    return {
      exchange: 'binance-futures',
      symbol: s.toUpperCase(),
      bids,
      asks,
      timestamp: T,
    };
  }

  private parseLevels(raw: unknown): BookLevel[] | null {
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

  private handleLiquidation(data: unknown): void {
    const l = this.parseLiquidation(data);
    if (!l) return;
    if (l.symbol.toUpperCase() !== this.symbol.toUpperCase()) return;
    const cb = this.handlers.onLiquidation;
    if (cb) cb(l);
  }

  private parseLiquidation(data: unknown): NormalizedLiquidation | null {
    if (!this.isPlainObject(data)) return null;
    const obj = data as Record<string, unknown>;
    const o = obj['o'];
    if (!this.isPlainObject(o)) return null;
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
    const long = S === 'SELL';
    return {
      exchange: 'binance-futures',
      symbol: s.toUpperCase(),
      t: T,
      price: p,
      usd: ap * q,
      long,
    };
  }

  private handleMarkPrice(data: unknown): void {
    const m = this.parseMarkPrice(data);
    if (!m) return;
    const cb = this.handlers.onMarkPrice;
    if (cb) cb(m);
  }

  private parseMarkPrice(data: unknown): NormalizedMarkPrice | null {
    if (!this.isPlainObject(data)) return null;
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

  private isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  private isEnvelope(v: unknown): v is { stream: string; data: unknown } {
    if (!this.isPlainObject(v)) return false;
    const obj = v as Record<string, unknown>;
    return typeof obj['stream'] === 'string' && 'data' in obj;
  }
}

