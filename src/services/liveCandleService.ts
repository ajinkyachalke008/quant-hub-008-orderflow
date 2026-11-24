import type { Candle } from '../types/terminal';

// Map UI timeframe to Binance interval
const TF_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1d',
  'ALL': '1w',
};

// Map display symbol to Binance spot symbol
function toBinanceSpotSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  // Gold uses PAXG
  if (['XAUUSD', 'XAU/USD', 'GOLD', 'XAU', 'PAXG'].includes(upper)) return 'paxgusdt';
  // Crypto pairs
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'DOGE'].includes(upper)) {
    return `${upper.toLowerCase()}usdt`;
  }
  // If already ends with USDT
  if (upper.endsWith('USDT')) return upper.toLowerCase();
  return `${upper.toLowerCase()}usdt`;
}

type CandleUpdateCallback = (candles: Candle[]) => void;

export class LiveCandleService {
  private ws: WebSocket | null = null;
  private symbol: string = '';
  private interval: string = '1h';
  private candles: Candle[] = [];
  private callbacks: Set<CandleUpdateCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly maxBackoffMs: number = 30000;
  private manuallyClosed: boolean = false;

  /**
   * Start live candle updates for a symbol + timeframe.
   * Fetches initial history from the existing /api/chart endpoint,
   * then opens a WS to update the last candle in real-time.
   */
  async start(symbol: string, timeframe: string): Promise<void> {
    this.stop(); // clean up any existing connection
    this.symbol = symbol;
    this.interval = TF_MAP[timeframe] || '1h';
    this.manuallyClosed = false;
    this.reconnectAttempts = 0;

    // 1. Fetch initial history from REST (via server /api/chart or marketData)
    try {
      this.candles = await this.fetchInitialCandles(symbol, timeframe);
    } catch {
      this.candles = [];
    }

    // Emit initial candles
    this.emit();

    // 2. Open WS for live updates
    this.connect();
  }

  private async fetchInitialCandles(symbol: string, timeframe: string): Promise<Candle[]> {
    // Try the existing /api/chart endpoint first (server-side, no CORS)
    try {
      const resp = await fetch(`/api/chart/${encodeURIComponent(symbol)}?tf=${timeframe}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch { /* fall through */ }

    // Fallback: direct Binance spot klines REST
    try {
      const binanceSym = toBinanceSpotSymbol(symbol).toUpperCase();
      const interval = TF_MAP[timeframe] || '1h';
      const resp = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${interval}&limit=200`
      );
      if (resp.ok) {
        const data = await resp.json();
        return data.map((k: any[]) => ({
          time: new Date(k[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
      }
    } catch { /* fall through */ }

    return [];
  }

  private connect(): void {
    const binanceSym = toBinanceSpotSymbol(this.symbol);
    const url = `wss://stream.binance.com:9443/stream?streams=${binanceSym}@kline_${this.interval}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.stream && msg.data && msg.data.e === 'kline') {
            this.handleKline(msg.data.k);
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        if (this.manuallyClosed) return;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        if (this.manuallyClosed) return;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleKline(k: any): void {
    const candle: Candle = {
      time: new Date(k.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };

    if (k.x) {
      // This candle is CLOSED — it's the final version of the last candle.
      // Replace the last candle with the closed version (it was already being updated live).
      if (this.candles.length > 0) {
        this.candles[this.candles.length - 1] = candle;
      } else {
        this.candles.push(candle);
      }
    } else {
      // Candle is still forming — update the last candle OR append a new one
      const lastCandle = this.candles[this.candles.length - 1];
      if (lastCandle && lastCandle.timestamp === k.t) {
        // Same candle, update in place (mutate for performance)
        lastCandle.close = candle.close;
        lastCandle.high = candle.high;
        lastCandle.low = candle.low;
        lastCandle.volume = candle.volume;
      } else {
        // New candle started — append
        this.candles.push(candle);
        // Keep array bounded (max 500 candles)
        if (this.candles.length > 500) {
          this.candles.shift();
        }
      }
    }

    this.emit();
  }

  private emit(): void {
    // Pass a shallow copy so consumers don't mutate our internal array
    const snapshot = [...this.candles];
    for (const cb of this.callbacks) {
      try { cb(snapshot); } catch { /* ignore */ }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxBackoffMs);
    this.reconnectAttempts = Math.min(this.reconnectAttempts + 1, this.maxReconnectAttempts);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoff);
  }

  stop(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Subscription API
  subscribe(cb: CandleUpdateCallback): () => void {
    this.callbacks.add(cb);
    // Immediately emit current candles to the new subscriber
    cb([...this.candles]);
    return () => { this.callbacks.delete(cb); };
  }

  getCandles(): Candle[] {
    return [...this.candles];
  }

  getStatus(): 'CONNECTING' | 'LIVE' | 'DISCONNECTED' {
    if (!this.ws) return 'DISCONNECTED';
    if (this.ws.readyState === WebSocket.OPEN) return 'LIVE';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'CONNECTING';
    return 'DISCONNECTED';
  }
}

// Singleton instance
export const liveCandleService = new LiveCandleService();
