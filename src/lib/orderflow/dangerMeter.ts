// dangerMeter.ts — Danger level computation (pure logic, no store imports).
// All thresholds CONFIRMED from Tradfye source (research 08, section I).

import { DangerSnapshot, MarketRegime } from '../../types/orderFlow';

export const VPIN_ELEVATED = 0.9;
export const VPIN_TOXIC = 0.97;
export const LIQ_BURST_ABS_USD = 250_000;
export const LIQ_BURST_LARGE_USD = 2_000_000;
export const LIQ_BURST_MULTIPLIER = 5;

export function isLiquidationBurst(rolling60sUsd: number, hourlyAvgUsd: number): boolean {
  if (rolling60sUsd >= LIQ_BURST_LARGE_USD) return true;
  if (rolling60sUsd >= LIQ_BURST_ABS_USD) return true;
  if (hourlyAvgUsd > 0 && rolling60sUsd >= LIQ_BURST_MULTIPLIER * hourlyAvgUsd) return true;
  return false;
}

export function computeDangerLevel(inputs: {
  vpinPct: number | null;
  liq60sUsd: number;
  liqHourlyAvgUsd: number;
  futuresSpotDiffBps: number;
  regime: MarketRegime;
}): DangerSnapshot {
  const { vpinPct, liq60sUsd, liqHourlyAvgUsd, futuresSpotDiffBps, regime } = inputs;
  let level = 0;

  const burst = isLiquidationBurst(liq60sUsd, liqHourlyAvgUsd);
  const toxic = vpinPct !== null && vpinPct >= VPIN_TOXIC;
  const vpinElevated = vpinPct !== null && vpinPct >= VPIN_ELEVATED;

  if (toxic || burst) level += 1;
  if (liq60sUsd >= LIQ_BURST_LARGE_USD || vpinElevated || futuresSpotDiffBps >= 6) level += 1;

  const dangerLevel: DangerSnapshot['level'] = level >= 2 ? 'HIGH' : level === 1 ? 'ELEVATED' : 'CALM';

  return {
    level: dangerLevel,
    inputs: {
      vpinPct: vpinPct ?? -1,
      liq60sUsd,
      liqHourlyAvgUsd,
      futuresSpotDiffBps,
      regimeCode: regime === 'trend' ? 3 : regime === 'volatile' ? 2 : regime === 'unclear' ? 1 : 0,
    },
  };
}

