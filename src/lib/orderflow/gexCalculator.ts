// gexCalculator.ts — Black-Scholes gamma + GEX profile (pure logic, no store imports).
// Formula CONFIRMED from Tradfye source (research 08, section J).
// Deribit markIv is PERCENT -> ivDecimal = markIv / 100.

import { NormalizedOption } from '../../types/orderFlow';

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
const MIN_T_YEARS = 1 / (365 * 24); // 1 hour floor to avoid singularity

export function bsGamma(spot: number, strike: number, tYears: number, ivDecimal: number): number {
  if (spot <= 0 || strike <= 0 || ivDecimal <= 0 || !isFinite(spot) || !isFinite(strike)) return 0;
  const t = Math.max(tYears, MIN_T_YEARS);
  const a = ivDecimal * Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + 0.5 * ivDecimal * ivDecimal * t) / a;
  return Math.exp(-0.5 * d1 * d1) / SQRT_2PI / (spot * a);
}

export function optionGex(gamma: number, openInterest: number, spot: number): number {
  return gamma * openInterest * spot * spot * 0.01;
}

export function computeGexProfile(
  options: NormalizedOption[],
  spot: number
): {
  prices: number[];
  netGex: number[];
  callWall: number;
  putWall: number;
  flipLevel: number | null;
  maxPain: number | null;
} {
  const prices: number[] = [];
  const netGex: number[] = [];
  const now = Date.now();
  const lo = spot * 0.75;
  const hi = spot * 1.25;
  const STEPS = 101;

  let callWall = -Infinity;
  let putWall = -Infinity;
  let flipLevel: number | null = null;
  let maxPain: number | null = null;
  let minPain = Infinity;

  const callGexByStrike: number[] = [];
  const putGexByStrike: number[] = [];

  for (let i = 0; i < STEPS; i++) {
    const p = lo + ((hi - lo) * i) / (STEPS - 1);
    prices.push(p);
    let net = 0;
    let callSum = 0;
    let putSum = 0;
    for (const o of options) {
      if (o.optionType !== 'call' && o.optionType !== 'put') continue;
      const ivDecimal = o.markIv / 100;
      const tYears = Math.max((o.expiry - now) / MS_PER_YEAR, 0);
      const gamma = bsGamma(p, o.strike, tYears, ivDecimal);
      const q = optionGex(gamma, o.openInterest, p);
      if (o.optionType === 'call') callSum += q;
      else putSum -= q;
    }
    net = callSum + putSum;
    netGex.push(net);
    callGexByStrike.push(callSum);
    putGexByStrike.push(putSum);

    if (callSum > callWall) callWall = p;
    if (Math.abs(putSum) > putWall) putWall = p;

    if (flipLevel === null && i > 0 && netGex[i - 1] !== 0 && Math.sign(net) !== Math.sign(netGex[i - 1])) {
      flipLevel = p;
    }

    let pain = 0;
    for (const o of options) {
      if (o.optionType === 'call') pain += Math.max(0, p - o.strike) * o.openInterest;
      else pain += Math.max(0, o.strike - p) * o.openInterest;
    }
    if (pain < minPain) {
      minPain = pain;
      maxPain = p;
    }
  }

  return {
    prices,
    netGex,
    callWall: callWall === -Infinity ? spot : callWall,
    putWall: putWall === Infinity ? spot : putWall,
    flipLevel,
    maxPain,
  };
}

