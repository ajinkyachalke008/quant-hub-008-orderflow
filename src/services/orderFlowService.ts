// orderFlowService.ts — Owns BinanceFuturesAdapter, feeds Zustand store, computes DecisionSnapshot.
// No React imports. Maintains rolling session CVD (reset UTC 00:00), rolling windows for signals,
// session VWAP. Computes DecisionSnapshot at most every 1000ms; requires >= 50 trades.

import { BinanceFuturesAdapter } from './adapters/BinanceFuturesAdapter';
import { useOrderFlowStore } from '../stores/orderFlowStore';
import {
  NormalizedTrade,
  NormalizedDepth,
  NormalizedLiquidation,
  NormalizedMarkPrice,
  DecisionSnapshot,
  DangerSnapshot,
  MarketRegime,
} from '../types/orderFlow';
import {
  detectRegime,
  valueSignal,
  smoothScore,
  computeDecisionScore,
  evaluateGates,
  computeConfidence,
  classifyDirection,
  MIN_TRADES_FOR_SCORE,
} from '../lib/orderflow/decisionEngine';
import { computeDangerLevel, isLiquidationBurst } from '../lib/orderflow/dangerMeter';

const DECISION_INTERVAL_MS = 1000;
const TRADE_STALE_MS = 10_000;
const DEPTH_STALE_MS = 500;
const MARK_STALE_MS = 5_000;

export class OrderFlowService {
  private adapter: BinanceFuturesAdapter;
  private symbol: string;
  private started = false;
  private lastDecisionTime = 0;
  private lastCvdResetDate = '';
  private sessionCvd = 0;
  private sessionVwap = 0;
  private vwapSumPV = 0;
  private vwapSumVol = 0;
  private trades: NormalizedTrade[] = [];
  private liquidations: NormalizedLiquidation[] = [];
  private lastTradeTime = 0;
  private lastDepthTime = 0;
  private lastMarkTime = 0;
  private smoothedScore = 0;
  private lastRegime: MarketRegime | null = null;
  private decisionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(symbol: string = 'BTCUSDT') {
    this.symbol = symbol;
    this.adapter = new BinanceFuturesAdapter(symbol);
    this.wireAdapter();
  }

  private wireAdapter(): void {
    this.adapter.onTrade((t) => this.onTrade(t));
    this.adapter.onDepth((d) => this.onDepth(d));
    this.adapter.onLiquidation((l) => this.onLiquidation(l));
    this.adapter.onMarkPrice((m) => this.onMarkPrice(m));
  }

  public start(symbol?: string): void {
    if (symbol && symbol !== this.symbol) {
      this.switchSymbol(symbol);
      return;
    }
    if (this.started) return;
    this.started = true;
    this.adapter.connect();
    this.decisionTimer = setInterval(() => this.maybeComputeDecision(), DECISION_INTERVAL_MS);
    useOrderFlowStore.getState().setFeedState('adapter', 'CONNECTING');
  }

  public stop(): void {
    if (!this.started) return;
    this.started = false;
    this.adapter.disconnect();
    if (this.decisionTimer) {
      clearInterval(this.decisionTimer);
      this.decisionTimer = null;
    }
    useOrderFlowStore.getState().setFeedState('adapter', 'DISCONNECTED');
  }

  public switchSymbol(symbol: string): void {
    if (symbol === this.symbol) return;
    this.adapter.disconnect();
    this.symbol = symbol;
    this.adapter = new BinanceFuturesAdapter(symbol);
    this.wireAdapter();
    this.resetSession();
    useOrderFlowStore.getState().resetOrderFlowBuffers(symbol);
    if (this.started) {
      this.adapter.connect();
      useOrderFlowStore.getState().setFeedState('adapter', 'CONNECTING');
    }
  }

  private resetSession(): void {
    this.sessionCvd = 0;
    this.sessionVwap = 0;
    this.vwapSumPV = 0;
    this.vwapSumVol = 0;
    this.trades = [];
    this.liquidations = [];
    this.lastTradeTime = 0;
    this.lastDepthTime = 0;
    this.lastMarkTime = 0;
    this.smoothedScore = 0;
    this.lastRegime = null;
    this.lastCvdResetDate = '';
  }

  private onTrade(t: NormalizedTrade): void {
    const now = Date.now();
    this.checkSessionReset(now);
    const delta = t.side === 'buy' ? t.quoteQty : -t.quoteQty;
    this.sessionCvd += delta;
    this.vwapSumPV += t.price * t.qty;
    this.vwapSumVol += t.qty;
    this.sessionVwap = this.vwapSumVol > 0 ? this.vwapSumPV / this.vwapSumVol : t.price;
    this.trades.push(t);
    if (this.trades.length > 500) this.trades.shift();
    this.lastTradeTime = now;
    useOrderFlowStore.getState().addTrade(t);
  }

  private onDepth(d: NormalizedDepth): void {
    this.lastDepthTime = Date.now();
    useOrderFlowStore.getState().setDepth(d);
  }

  private onLiquidation(l: NormalizedLiquidation): void {
    this.liquidations.push(l);
    if (this.liquidations.length > 10000) this.liquidations.shift();
    useOrderFlowStore.getState().addLiquidation(l);
    this.maybeComputeDanger();
  }

  private onMarkPrice(m: NormalizedMarkPrice): void {
    this.lastMarkTime = Date.now();
    useOrderFlowStore.getState().setMarkPrice(m);
    const ctx = this.currentMarkPrice();
    if (ctx) useOrderFlowStore.getState().setFuturesContext(ctx);
    this.maybeComputeDanger();
  }

  private checkSessionReset(now: number): void {
    const d = new Date(now);
    const dateKey = d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' + d.getUTCDate();
    if (this.lastCvdResetDate === '') this.lastCvdResetDate = dateKey;
    else if (dateKey !== this.lastCvdResetDate) {
      this.lastCvdResetDate = dateKey;
      this.sessionCvd = 0;
    }
  }

  private currentMarkPrice() {
    const state = useOrderFlowStore.getState();
    return state.markPrice
      ? {
          symbol: this.symbol,
          markPrice: state.markPrice.markPrice,
          indexPrice: state.markPrice.indexPrice,
          fundingRate: state.markPrice.fundingRate,
          nextFundingTime: state.markPrice.nextFundingTime,
          openInterest: 0,
          openInterestUsd: 0,
          timestamp: state.markPrice.timestamp,
        }
      : null;
  }

  private maybeComputeDanger(): void {
    const now = Date.now();
    const liq60 = this.liquidations.filter((l) => l.t >= now - 60_000).reduce((s, l) => s + l.usd, 0);
    const liqHourly = this.liquidations
      .filter((l) => l.t >= now - 3600_000)
      .reduce((s, l) => s + l.usd, 0) / 60;
    const regime = this.lastRegime ?? 'range';
    const state = useOrderFlowStore.getState();
    const mark = state.markPrice;
    const diffBps =
      mark && mark.indexPrice > 0
        ? Math.abs(mark.markPrice - mark.indexPrice) / mark.indexPrice * 10000
        : 0;
    const vpinPct = this.computeVpin(now);
    const danger: DangerSnapshot = computeDangerLevel({
      vpinPct,
      liq60sUsd: liq60,
      liqHourlyAvgUsd: liqHourly,
      futuresSpotDiffBps: diffBps,
      regime,
    });
    state.setDanger(danger);
  }

  private computeVpin(now: number): number | null {
    const bucket = this.trades.filter((t) => t.timestamp >= now - 60_000);
    if (bucket.length < MIN_TRADES_FOR_SCORE) return null;
    let buyVol = 0;
    let sellVol = 0;
    for (const t of bucket) {
      if (t.side === 'buy') buyVol += t.quoteQty;
      else sellVol += t.quoteQty;
    }
    const total = buyVol + sellVol;
    return total > 0 ? Math.abs(buyVol - sellVol) / total : 0;
  }

  private maybeComputeDecision(): void {
    const now = Date.now();
    if (now - this.lastDecisionTime < DECISION_INTERVAL_MS) return;
    this.lastDecisionTime = now;

    if (this.trades.length < MIN_TRADES_FOR_SCORE) return;

    const cutoff10 = now - 10_000;
    const cutoff60 = now - 60_000;
    const cutoff5m = now - 300_000;

    const recent10 = this.trades.filter((t) => t.timestamp >= cutoff10);
    const recent60 = this.trades.filter((t) => t.timestamp >= cutoff60);
    const recent5m = this.trades.filter((t) => t.timestamp >= cutoff5m);

    const aggression = (arr: NormalizedTrade[]) => {
      let buy = 0;
      let sell = 0;
      for (const t of arr) {
        if (t.side === 'buy') buy += t.quoteQty;
        else sell += t.quoteQty;
      }
      const total = buy + sell;
      return total > 0 ? (buy - sell) / total : 0;
    };

    const aggression60 = aggression(recent60);
    const aggression10 = aggression(recent10);

    const cvd5m = recent5m.reduce((s, t) => s + (t.side === 'buy' ? t.quoteQty : -t.quoteQty), 0);
    const cvdTrend = Math.max(-1, Math.min(1, cvd5m / (this.sessionCvd || 1)));

    let bookSig = 0;
    const depth = useOrderFlowStore.getState().depth;
    if (depth) {
      const bidVol = depth.bids.slice(0, 10).reduce((s, l) => s + l.qty, 0);
      const askVol = depth.asks.slice(0, 10).reduce((s, l) => s + l.qty, 0);
      const total = bidVol + askVol;
      if (total > 0) bookSig = (bidVol - askVol) / total;
    }

    const valueSig = valueSignal(this.sessionVwap, this.sessionVwap, this.sessionVwap);

    let largePrints = 0;
    const large = recent60.filter((t) => t.quoteQty >= 50_000);
    if (large.length > 0) {
      let lb = 0;
      let ls = 0;
      for (const t of large) {
        if (t.side === 'buy') lb += t.quoteQty;
        else ls += t.quoteQty;
      }
      const total = lb + ls;
      if (total > 0) largePrints = (lb - ls) / total;
    }

    const stacked = aggression60; // heuristic proxy: consecutive aggression
    const absorption = Math.min(1, Math.abs(cvd5m) / (this.sessionCvd || 1)); // heuristic
    const liquidity = bookSig; // heuristic

    const { raw, weighted } = computeDecisionScore([
      { name: 'aggression60', normalized: aggression60 },
      { name: 'aggression10', normalized: aggression10 },
      { name: 'cvdTrend', normalized: cvdTrend },
      { name: 'book', normalized: bookSig },
      { name: 'value', normalized: valueSig },
      { name: 'largePrints', normalized: largePrints },
      { name: 'stacked', normalized: stacked },
      { name: 'absorption', normalized: absorption },
      { name: 'liquidity', normalized: liquidity },
    ]);

    this.smoothedScore = smoothScore(this.smoothedScore, raw);
    const regime = detectRegime(this.smoothedScore);
    const direction = classifyDirection(this.smoothedScore, regime);

    const gates = evaluateGates({
      scoreNorm: Math.abs(this.smoothedScore) / 101,
      activity: Math.min(1, recent60.length / 100),
      flow: 0.5,
      targetCost: 0,
      rr: 0,
      trendAligned: Math.sign(this.smoothedScore) === Math.sign(aggression60),
    });

    const confidence = computeConfidence({
      scoreNorm: Math.abs(this.smoothedScore) / 101,
      agreement: Math.abs(aggression60),
      activity: Math.min(1, recent60.length / 100),
      trend: Math.abs(cvdTrend),
      rr: 0,
    });

    const decision: DecisionSnapshot = {
      score: this.smoothedScore,
      rawScore: raw,
      regime,
      direction,
      confidence,
      signals: weighted,
      gates,
      sampleCount: this.trades.length,
    };

    useOrderFlowStore.getState().setDecision(decision);

    if (regime !== this.lastRegime) {
      this.lastRegime = regime;
      this.maybeComputeDanger();
    }
  }

  private updateFeedState(): void {
    const state = useOrderFlowStore.getState();
    const adapterStatus = this.adapter.getStatus();
    const now = Date.now();

    const feeds: [string, number, number][] = [
      ['trades', this.lastTradeTime, TRADE_STALE_MS],
      ['depth', this.lastDepthTime, DEPTH_STALE_MS],
      ['mark', this.lastMarkTime, MARK_STALE_MS],
    ];

    for (const [name, last, staleMs] of feeds) {
      let s = adapterStatus;
      if (adapterStatus === 'LIVE') {
        if (last === 0 || now - last > staleMs) s = 'STALE';
      }
      state.setFeedState(name, s);
    }
    state.setFeedState('adapter', adapterStatus);
  }

  public startFeedMonitor(): void {
    this.updateFeedState();
  }
}
