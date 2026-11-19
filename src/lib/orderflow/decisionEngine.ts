// decisionEngine.ts — Pure decision-scoring logic (no React, no store imports).
// All constants are CONFIRMED from Tradfye source extraction (see research 08).
// Individual signal formulas marked heuristic where inferred; UI must label them.

import { DecisionSignal, DecisionSignalName, MarketRegime } from '../../types/orderFlow';

export const DECISION_WEIGHTS = {
  aggression60: 20,
  absorption: 15,
  cvdTrend: 12,
  liquidity: 12,
  aggression10: 10,
  stacked: 10,
  value: 8,
  largePrints: 8,
  book: 6,
} as const;

export const SMOOTHING_DT = 0.3;
export const THRESHOLD_NORMAL = 22;
export const THRESHOLD_VOLATILE = 10;
export const LEAN_THRESHOLD = 8;
export const REGIME_THRESHOLDS = { range: 30, unclear: 45, trend: 70, volatile: 60 } as const;
export const GATE_ACTIVITY_MIN = 0.5;
export const GATE_FLOW_MIN = 0.5;
export const GATE_TARGET_COST_MIN = 2.5;
export const GATE_RR_MIN = 1.2;
export const CONFIDENCE_WEIGHTS = { score: 0.35, agreement: 0.2, activity: 0.2, trend: 0.15, rr: 0.1 } as const;
export const MIN_TRADES_FOR_SCORE = 50;

export const TOTAL_WEIGHT: number = Object.values(DECISION_WEIGHTS).reduce((a, b) => a + b, 0);

function clampSigned(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function clampUnsigned(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function detectRegime(score: number): MarketRegime {
  const a = Math.abs(score);
  if (a >= REGIME_THRESHOLDS.trend) return 'trend';
  if (a >= REGIME_THRESHOLDS.volatile) return 'volatile';
  if (a >= REGIME_THRESHOLDS.unclear) return 'unclear';
  if (a < REGIME_THRESHOLDS.range) return 'range';
  return 'unclear';
}

export function valueSignal(price: number, vah: number, val: number): number {
  if (price > vah) return 1;
  if (price < val) return -1;
  return 0;
}

export function smoothScore(prev: number, raw: number): number {
  return prev + SMOOTHING_DT * (raw - prev);
}

export function computeDecisionScore(
  signals: { name: DecisionSignalName; normalized: number }[]
): { raw: number; weighted: DecisionSignal[] } {
  let raw = 0;
  const weighted: DecisionSignal[] = [];
  for (const s of signals) {
    const w = DECISION_WEIGHTS[s.name];
    const n = clampSigned(s.normalized);
    raw += w * n;
    weighted.push({ name: s.name, weight: w, value: n });
  }
  return { raw, weighted };
}

export interface GateContext {
  scoreNorm: number; // |score| / TOTAL_WEIGHT, 0..1
  activity: number; // fraction of recent window with trades, 0..1
  flow: number; // taker-driven fraction of volume, 0..1
  targetCost: number; // target / cost ratio
  rr: number; // net risk-reward ratio
  trendAligned: boolean; // score sign matches higher-timeframe trend
}

export function evaluateGates(ctx: {
  scoreNorm: number;
  activity: number;
  flow: number;
  targetCost: number;
  rr: number;
  trendAligned: boolean;
}): { strength: boolean; activity: boolean; flow: boolean; targetCost: boolean; rr: boolean; trend: boolean } {
  return {
    strength: ctx.scoreNorm * TOTAL_WEIGHT >= THRESHOLD_NORMAL,
    activity: ctx.activity >= GATE_ACTIVITY_MIN,
    flow: ctx.flow >= GATE_FLOW_MIN,
    targetCost: ctx.targetCost >= GATE_TARGET_COST_MIN,
    rr: ctx.rr >= GATE_RR_MIN,
    trend: ctx.trendAligned,
  };
}

export function computeConfidence(parts: {
  scoreNorm: number;
  agreement: number;
  activity: number;
  trend: number;
  rr: number;
}): number {
  const w = CONFIDENCE_WEIGHTS;
  const v =
    w.score * clampUnsigned(parts.scoreNorm) +
    w.agreement * clampUnsigned(parts.agreement) +
    w.activity * clampUnsigned(parts.activity) +
    w.trend * clampUnsigned(parts.trend) +
    w.rr * clampUnsigned(parts.rr);
  return clampUnsigned(v) * 100;
}

export function classifyDirection(
  score: number,
  regime: MarketRegime
): 'BUY' | 'SELL' | 'LEAN_BUY' | 'LEAN_SELL' | 'NEUTRAL' {
  const a = Math.abs(score);
  if (a < LEAN_THRESHOLD) return 'NEUTRAL';
  const threshold = regime === 'volatile' ? THRESHOLD_VOLATILE : THRESHOLD_NORMAL;
  if (a >= threshold) return score > 0 ? 'BUY' : 'SELL';
  return score > 0 ? 'LEAN_BUY' : 'LEAN_SELL';
}
