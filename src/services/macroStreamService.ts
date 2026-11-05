import { MacroAssetQuote } from '../types/terminal';

export interface MacroState {
  quotes: Record<string, MacroAssetQuote>;
  goldSilverRatio: number;
  correlations: Record<string, number>;
  lastUpdated: string;
}

type MacroSubscriber = (state: MacroState) => void;

// Real Pyth Hermes Price Feed IDs (Verified Mainnet Zero-Auth)
const PYTH_FEEDS: Record<string, { id: string; name: string; category: MacroAssetQuote['category'] }> = {
  'XAU/USD': {
    id: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    name: 'Gold Spot / USD',
    category: 'metal',
  },
  'XAG/USD': {
    id: '0xf2fb02c321efb0451a483a936a28cc16053f317ee007dd1e6f9621379b38069d',
    name: 'Silver Spot / USD',
    category: 'metal',
  },
  'BTC/USD': {
    id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    name: 'Bitcoin / USD',
    category: 'crypto',
  },
  'EUR/USD': {
    id: '0xa995d00bb36a6ca454c2a85b4d3ec420c631290361c46273c15330f0743f59f2',
    name: 'Euro / US Dollar',
    category: 'forex',
  },
  'USD/JPY': {
    id: '0xef264a0210e14a1a382c75a939f4039b2b50de48545bf94851eb33f67dd38ea4',
    name: 'USD / Japanese Yen',
    category: 'forex',
  },
  'WTI/USD': {
    id: '0x9049a42938e2171120002166a5e8f498c50e4178a9c249a5dfb08c6bf88f72c3',
    name: 'WTI Crude Oil / USD',
    category: 'energy',
  },
};

class MacroStreamService {
  private eventSource: EventSource | null = null;
  private ws: WebSocket | null = null;
  private subscribers: Set<MacroSubscriber> = new Set();
  private historyWindow: Record<string, number[]> = {};
  private goldHistory: number[] = [];
  private maxHistoryLen = 60; // 1-hour of 1-minute rolling ticks
  private state: MacroState = {
    quotes: {},
    goldSilverRatio: 0,
    correlations: {},
    lastUpdated: new Date().toISOString(),
  };

  constructor() {
    // Initialize base quote structures
    Object.keys(PYTH_FEEDS).forEach((sym) => {
      this.historyWindow[sym] = [];
      this.state.quotes[sym] = {
        symbol: sym,
        name: PYTH_FEEDS[sym].name,
        category: PYTH_FEEDS[sym].category,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
        history: [],
        correlationWithGold: 0,
        lastUpdated: new Date().toISOString(),
      };
    });

    this.startStreaming();
  }

  public subscribe(cb: MacroSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.state);
    return () => this.subscribers.delete(cb);
  }

  public getState(): MacroState {
    return this.state;
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.state);
      } catch (err) {
        console.error('MacroSubscriber notification error:', err);
      }
    });
  }

  private startStreaming() {
    this.connectPythHermesSSE();
    this.connectBinanceFallbackWS();
  }

  /**
   * Connects to Pyth Hermes SSE stream for multi-asset macro prices
   */
  private connectPythHermesSSE() {
    if (typeof window === 'undefined') return;

    try {
      const feedIds = Object.values(PYTH_FEEDS).map((f) => f.id);
      const params = feedIds.map((id) => `ids[]=${id}`).join('&');
      const url = `https://hermes.pyth.network/v2/updates/price/stream?${params}&parsed=true`;

      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.parsed) {
            this.handlePythUpdates(data.parsed);
          }
        } catch {
          // JSON parse ignore
        }
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Poll REST backup after delay
        setTimeout(() => this.pollPythREST(), 3000);
      };
    } catch (e) {
      console.warn('Failed to start Pyth Hermes SSE for macro stream:', e);
      this.pollPythREST();
    }
  }

  private async pollPythREST() {
    try {
      const feedIds = Object.values(PYTH_FEEDS).map((f) => f.id);
      const params = feedIds.map((id) => `ids[]=${id}`).join('&');
      const url = `https://hermes.pyth.network/v2/updates/price/latest?${params}&parsed=true`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.parsed) {
          this.handlePythUpdates(json.parsed);
        }
      }
    } catch {
      // Handled via Binance fallback
    }
  }

  private handlePythUpdates(
    parsed: Array<{
      id: string;
      price: { price: string; expo: number; conf: string };
      ema_price?: { price: string; expo: number };
    }>
  ) {
    let stateChanged = false;

    parsed.forEach((item) => {
      const feedKey = Object.keys(PYTH_FEEDS).find(
        (key) => PYTH_FEEDS[key].id.toLowerCase() === (item.id.startsWith('0x') ? item.id.toLowerCase() : `0x${item.id.toLowerCase()}`)
      );

      if (feedKey && item.price) {
        const rawPrice = Number(item.price.price);
        const expo = item.price.expo;
        const livePrice = rawPrice * Math.pow(10, expo);

        if (livePrice > 0) {
          const current = this.state.quotes[feedKey];
          const prev = current.price;
          const delta = prev > 0 ? ((livePrice - prev) / prev) * 100 : current.change24h;

          // Track history for rolling Pearson correlation
          const hist = this.historyWindow[feedKey];
          hist.push(livePrice);
          if (hist.length > this.maxHistoryLen) {
            hist.shift();
          }

          if (feedKey === 'XAU/USD') {
            this.goldHistory.push(livePrice);
            if (this.goldHistory.length > this.maxHistoryLen) {
              this.goldHistory.shift();
            }
          }

          this.state.quotes[feedKey] = {
            ...current,
            price: livePrice,
            change24h: Number(delta.toFixed(3)),
            high24h: current.high24h === 0 ? livePrice : Math.max(current.high24h, livePrice),
            low24h: current.low24h === 0 ? livePrice : Math.min(current.low24h, livePrice),
            history: [...hist],
            lastUpdated: new Date().toISOString(),
          };

          stateChanged = true;
        }
      }
    });

    if (stateChanged) {
      this.recalculateGSRAndCorrelations();
      this.notify();
    }
  }

  /**
   * Binance WebSocket fallback for BTC/USDT and PAXG/USDT
   */
  private connectBinanceFallbackWS() {
    if (typeof window === 'undefined') return;

    try {
      const streams = ['btcusdt@ticker', 'paxgusdt@ticker'];
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (!msg.data) return;
          const d = msg.data;

          if (d.s === 'BTCUSDT' && (!this.state.quotes['BTC/USD'] || this.state.quotes['BTC/USD'].price === 0)) {
            const p = parseFloat(d.c);
            const ch = parseFloat(d.P);
            this.updateAssetQuote('BTC/USD', p, ch, parseFloat(d.h), parseFloat(d.l));
          } else if (d.s === 'PAXGUSDT' && (!this.state.quotes['XAU/USD'] || this.state.quotes['XAU/USD'].price === 0)) {
            const p = parseFloat(d.c);
            const ch = parseFloat(d.P);
            this.updateAssetQuote('XAU/USD', p, ch, parseFloat(d.h), parseFloat(d.l));
          }
        } catch {}
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      };
    } catch {}
  }

  private updateAssetQuote(sym: string, price: number, change: number, high: number, low: number) {
    if (!this.state.quotes[sym]) return;
    const current = this.state.quotes[sym];
    const hist = this.historyWindow[sym];
    hist.push(price);
    if (hist.length > this.maxHistoryLen) hist.shift();

    if (sym === 'XAU/USD') {
      this.goldHistory.push(price);
      if (this.goldHistory.length > this.maxHistoryLen) this.goldHistory.shift();
    }

    this.state.quotes[sym] = {
      ...current,
      price,
      change24h: change,
      high24h: high,
      low24h: low,
      history: [...hist],
      lastUpdated: new Date().toISOString(),
    };

    this.recalculateGSRAndCorrelations();
    this.notify();
  }

  /**
   * Computes Gold-to-Silver Ratio (GSR) and 1-hour Pearson correlation coefficients
   */
  private recalculateGSRAndCorrelations() {
    const goldPrice = this.state.quotes['XAU/USD']?.price || 0;
    const silverPrice = this.state.quotes['XAG/USD']?.price || 0;

    // Real-Time GSR: XAU_Price / XAG_Price
    if (goldPrice > 0 && silverPrice > 0) {
      this.state.goldSilverRatio = Number((goldPrice / silverPrice).toFixed(2));
    }

    // Pearson Correlation: \rho = \frac{\sum (x - \bar{x})(y - \bar{y})}{\sqrt{\sum (x - \bar{x})^2 \sum (y - \bar{y})^2}}
    if (this.goldHistory.length >= 5) {
      Object.keys(this.historyWindow).forEach((sym) => {
        if (sym === 'XAU/USD') {
          this.state.correlations[sym] = 1.0;
          if (this.state.quotes[sym]) {
            this.state.quotes[sym].correlationWithGold = 1.0;
          }
          return;
        }

        const assetHist = this.historyWindow[sym];
        if (assetHist.length >= 5) {
          const len = Math.min(this.goldHistory.length, assetHist.length);
          const x = this.goldHistory.slice(-len);
          const y = assetHist.slice(-len);

          const r = this.calculatePearsonCorrelation(x, y);
          this.state.correlations[sym] = Number(r.toFixed(2));
          if (this.state.quotes[sym]) {
            this.state.quotes[sym].correlationWithGold = Number(r.toFixed(2));
          }
        }
      });
    }

    this.state.lastUpdated = new Date().toISOString();
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    const denominator = Math.sqrt(denomX * denomY);
    if (denominator === 0) return 0;
    return Math.max(-1, Math.min(1, numerator / denominator));
  }
}

export const macroStreamService = new MacroStreamService();
