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
const PROXY_FALLBACK_MS = 3000;

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
  private es: EventSource | null = null;
  private status: FeedState = 'CONNECTING';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private proxyFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffIndex: number = 0;
  private manuallyClosed: boolean = false;
  private handlers: StreamHandlers = {};
  private orderbook: BybitOrderBookState = new BybitOrderBookState();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly proxyUrl: string | null;

  constructor(symbol: string = DEFAULT_SYMBOL, proxyUrl: string | null = null) {
    this.symbol = symbol.toUpperCase();
    this.proxyUrl = proxyUrl;
  }

  public connect(): void {
    this.disconnect();
    this.manuallyClosed = false;
    this.status = 'CONNECTING';
    this.backoffIndex = 0;
    this.orderbook = new BybitOrderBookState();

    const useProxy =
      this.proxyUrl != null
        ? true
        : typeof window !== 'undefined' &&
          (window.location.port === '3000' || import.meta.env.DEV);

    if (useProxy) {
      this.connectViaProxy();
    } else {
      this.connectDirect();
    }
  }

  /** Direct WebSocket connection (existing logic, used as fallback). */
  private connectDirect(): void {
    this.ws = new WebSocket(BASE_URL);

    this.ws.onopen = () => {
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
        this.ws?.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
      }
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

  /** Server-Sent Events proxy connection (same-origin Express server). */
  private connectViaProxy(): void {
    const base = this.proxyUrl ?? '/sse/bybit';
    const url = `${base}/${this.symbol}`;
    console.info('[BybitLinearAdapter] connecting via proxy', url);

    this.es = new EventSource(url);

    this.es.onopen = () => {
      if (this.proxyFallbackTimer !== null) {
        clearTimeout(this.proxyFallbackTimer);
        this.proxyFallbackTimer = null;
      }
      if (this.manuallyClosed) return;
      this.status = 'LIVE';
      console.info('[BybitLinearAdapter] proxy connected', this.symbol);
    };

    this.es.onmessage = (event: MessageEvent) => {
      
      let payload: unknown;
      try {
        payload = JSON.parse(event.data as string);
      } catch {
        console.debug('[BybitLinearAdapter] malformed proxy message dropped');
        return;
      }
      this.handleProxyMessage(payload);
    };

    this.es.onerror = () => {
      if (this.manuallyClosed) return;
      this.status = 'RECONNECTING';
      if (this.proxyFallbackTimer !== null) {
        this.closeProxy();
        this.connectDirect();
      }
    };

    this.proxyFallbackTimer = setTimeout(() => {
      this.proxyFallbackTimer = null;
      if (this.manuallyClosed) return;
      this.closeProxy();
      this.connectDirect();
    }, PROXY_FALLBACK_MS);
  }


  private closeProxy(): void {
    if (this.es !== null) {
      try {
        this.es.close();
      } catch {
        /* ignore */
      }
      this.es = null;
    }
  }

  private handleProxyMessage(payload: unknown): void {
    if (!isPlainObject(payload)) return;
    const obj = payload as Record<string, unknown>;
    const type = obj['type'];

    if (type === 'trade' || type === 'trades') {
      const trades =
        obj['trades'] ?? (type === 'trade' ? obj['trade'] : undefined);
      if (Array.isArray(trades)) {
        for (const t of trades) this.handleTrade(t);
      } else if (trades !== undefined) {
        this.handleTrade(trades);
      }
      return;
    }
    if (type === 'depth') {
      const d = obj['depth'];
      if (d) this.handleDepthFromProxy(d);
      return;
    }
    if (type === 'liquidation') {
      const l = obj['liquidation'];
      if (l) this.handleLiquidation(l);
      return;
    }
    if (type === 'markPrice') {
      const m = obj['markPrice'];
      if (m) this.handleMarkPrice(m);
      return;
    }
  }

  private handleDepthFromProxy(data: unknown): void {
    if (!isPlainObject(data)) return;
    const o = data as Record<string, unknown>;
    const b = o['b'];
    const a = o['a'];
    if (!Array.isArray(b) || !Array.isArray(a)) return;
    this.orderbook.applySnapshot(b as Array<[string, string]>, a as Array<[string, string]>);
    const seqNum = toNum(o['seq']);
    if (seqNum !== null) this.orderbook.setSeq(seqNum);
    this.emitDepth();
    this.status = 'LIVE';
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.proxyFallbackTimer !== null) {
      clearTimeout(this.proxyFallbackTimer);
      this.proxyFallbackTimer = null;
    }
    this.closeProxy();
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
    // Bybit answers a ping with {"op":"pong"}; some deployments answer
    // {"op":"ping","ret_msg":"pong"}. Accept both so a healthy socket is never
    // torn down by the pong timeout.
    if (obj['op'] === 'pong' || obj['ret_msg'] === 'pong') {
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
    } else if (topic.startsWith('allLiquidation.') || topic.startsWith('liquidation.')) {
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
      const cb = this.handlers.onLiquidation;
      if (cb) cb(liq);
    }
    this.status = 'LIVE';
  }

  private handleMarkPrice(data: unknown): void {
    const cb = this.handlers.onMarkPrice;
    if (cb) cb(data as NormalizedMarkPrice);
  }
}



