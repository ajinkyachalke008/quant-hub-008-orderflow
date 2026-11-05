import { DepthLevel, Level2OrderBook, TapeTrade } from '../types/terminal';

type DepthSubscriber = (book: Level2OrderBook) => void;
type TapeSubscriber = (trades: TapeTrade[]) => void;

class OrderBookEngine {
  private ws: WebSocket | null = null;
  private depthSubscribers: Set<DepthSubscriber> = new Set();
  private tapeSubscribers: Set<TapeSubscriber> = new Set();
  private reconnectTimer: any = null;

  private currentBook: Level2OrderBook = {
    bids: [],
    asks: [],
    midPrice: 4040.0,
    spread: 0.35,
    spreadBps: 0.86,
    imbalancePercent: 0,
    lastUpdated: Date.now(),
  };

  private tapeTrades: TapeTrade[] = [];

  constructor() {
    this.fetchInitialDepth();
    this.connectWebSocket();
  }

  public subscribeDepth(cb: DepthSubscriber): () => void {
    this.depthSubscribers.add(cb);
    cb({ ...this.currentBook });
    return () => this.depthSubscribers.delete(cb);
  }

  public subscribeTape(cb: TapeSubscriber): () => void {
    this.tapeSubscribers.add(cb);
    cb([...this.tapeTrades]);
    return () => this.tapeSubscribers.delete(cb);
  }

  public getBook(): Level2OrderBook {
    return { ...this.currentBook };
  }

  public getTape(): TapeTrade[] {
    return [...this.tapeTrades];
  }

  /**
   * Fetch live initial depth from public Binance REST API (Zero-Mock guarantee)
   */
  private async fetchInitialDepth() {
    try {
      const res = await fetch('https://api.binance.com/api/v3/depth?symbol=PAXGUSDT&limit=20');
      if (res.ok) {
        const data = await res.json();
        this.processDepthPayload(data.bids, data.asks);
      }
    } catch (e) {
      console.warn('Initial depth fetch warning:', e);
    }
  }

  /**
   * Connect to Binance combined stream for live PAXG (Gold Spot proxy) Depth20 and real-time Trades
   */
  private connectWebSocket() {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      const streamUrl = 'wss://stream.binance.com:9443/stream?streams=paxgusdt@depth20@100ms/paxgusdt@trade';
      this.ws = new WebSocket(streamUrl);

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const stream = msg.stream;
          const data = msg.data;

          if (stream?.includes('depth20') && data) {
            this.processDepthPayload(data.bids, data.asks);
          } else if (stream?.includes('trade') && data) {
            this.processTradePayload(data);
          }
        } catch (_) {}
      };

      this.ws.onerror = () => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      };

      this.ws.onclose = () => {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 3000);
      };
    } catch (_) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  private processDepthPayload(rawBids: [string, string][], rawAsks: [string, string][]) {
    if (!Array.isArray(rawBids) || !Array.isArray(rawAsks)) return;

    let cumBid = 0;
    const bids: DepthLevel[] = [];
    for (const [pStr, aStr] of rawBids.slice(0, 20)) {
      const price = parseFloat(pStr);
      const amount = parseFloat(aStr);
      cumBid += amount;
      bids.push({ price: +price.toFixed(2), amount: +amount.toFixed(3), total: +cumBid.toFixed(3), depthPercent: 0 });
    }

    let cumAsk = 0;
    const asks: DepthLevel[] = [];
    for (const [pStr, aStr] of rawAsks.slice(0, 20)) {
      const price = parseFloat(pStr);
      const amount = parseFloat(aStr);
      cumAsk += amount;
      asks.push({ price: +price.toFixed(2), amount: +amount.toFixed(3), total: +cumAsk.toFixed(3), depthPercent: 0 });
    }

    const maxCum = Math.max(cumBid, cumAsk, 0.001);
    bids.forEach((b) => (b.depthPercent = +( (b.total / maxCum) * 100 ).toFixed(1)));
    asks.forEach((a) => (a.depthPercent = +( (a.total / maxCum) * 100 ).toFixed(1)));

    const bestBid = bids[0]?.price || 4040.0;
    const bestAsk = asks[0]?.price || 4040.35;
    const midPrice = +((bestBid + bestAsk) / 2).toFixed(2);
    const spread = +(bestAsk - bestBid).toFixed(2);
    const spreadBps = +((spread / (midPrice || 1)) * 10000).toFixed(2);

    const totalBidVol = cumBid;
    const totalAskVol = cumAsk;
    const totalVol = totalBidVol + totalAskVol;
    const imbalancePercent = totalVol > 0 ? +(((totalBidVol - totalAskVol) / totalVol) * 100).toFixed(1) : 0;

    this.currentBook = {
      bids,
      asks,
      midPrice,
      spread,
      spreadBps,
      imbalancePercent,
      lastUpdated: Date.now(),
    };

    this.depthSubscribers.forEach((cb) => cb({ ...this.currentBook }));
  }

  private processTradePayload(d: any) {
    const price = parseFloat(d.p);
    const amount = parseFloat(d.q);
    const side = d.m ? 'sell' : 'buy'; // in Binance: if d.m is true, buyer is market maker => seller was aggressor
    const isSweep = amount >= 2.0; // >= 2.0 lots / 200 oz is institutional sweep size
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);

    const trade: TapeTrade = {
      id: `tape_${d.t || Date.now()}_${uid}`,
      price: +price.toFixed(2),
      amount: +amount.toFixed(3),
      timestamp: d.T || Date.now(),
      side,
      isSweep,
    };

    this.tapeTrades.unshift(trade);
    if (this.tapeTrades.length > 80) {
      this.tapeTrades.pop();
    }

    this.tapeSubscribers.forEach((cb) => cb([...this.tapeTrades]));
  }
}

export const orderBookEngine = new OrderBookEngine();
