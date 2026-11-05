import { Candle, VolumeProfileResult, VolumeProfileLevel, SessionLiquidityLevels } from '../types/terminal';

/**
 * Volume Profile Visible Range (VPVR) & Session Liquidity Engine
 * Calculates mathematically accurate price-by-volume distributions, Point of Control (POC),
 * Value Area High (VAH), Value Area Low (VAL, 70% threshold), and session sweeps directly
 * from live OHLCV candle streams.
 */
export class VolumeProfileEngine {
  /**
   * Calculates Volume Profile for the visible candles.
   * @param candles Slice of visible candles
   * @param bucketCount Number of horizontal price slices (default 50)
   */
  public static calculateVPVR(candles: Candle[], bucketCount = 50): VolumeProfileResult {
    if (!candles || candles.length === 0) {
      return {
        pocPrice: 0,
        vahPrice: 0,
        valPrice: 0,
        totalVolume: 0,
        levels: [],
      };
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalVolume = 0;

    candles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      totalVolume += c.volume || 1;
    });

    if (minPrice >= maxPrice || totalVolume <= 0) {
      const p = candles[candles.length - 1]?.close || 0;
      return {
        pocPrice: p,
        vahPrice: p,
        valPrice: p,
        totalVolume,
        levels: [],
      };
    }

    const step = (maxPrice - minPrice) / bucketCount;
    const buckets: { price: number; volume: number }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      buckets.push({
        price: minPrice + (i + 0.5) * step,
        volume: 0,
      });
    }

    // Distribute candle volume across the overlapping price bins
    candles.forEach((c) => {
      const vol = c.volume || 1;
      const cLow = c.low;
      const cHigh = c.high;
      const cRange = Math.max(0.01, cHigh - cLow);

      buckets.forEach((b) => {
        const binBottom = b.price - step / 2;
        const binTop = b.price + step / 2;

        // Calculate overlap fraction between candle range and bin range
        const overlapMin = Math.max(cLow, binBottom);
        const overlapMax = Math.min(cHigh, binTop);

        if (overlapMax > overlapMin) {
          const overlapFraction = (overlapMax - overlapMin) / cRange;
          b.volume += vol * overlapFraction;
        }
      });
    });

    // Find Point of Control (POC): Price bin with the highest volume
    let maxVol = 0;
    let pocIndex = 0;
    buckets.forEach((b, i) => {
      if (b.volume > maxVol) {
        maxVol = b.volume;
        pocIndex = i;
      }
    });

    const pocPrice = buckets[pocIndex]?.price || (minPrice + maxPrice) / 2;

    // Calculate Value Area (70% of total volume around the POC)
    const targetValueAreaVol = totalVolume * 0.70;
    let accumulatedVol = buckets[pocIndex]?.volume || 0;
    let lowerIdx = pocIndex;
    let upperIdx = pocIndex;

    while (accumulatedVol < targetValueAreaVol && (lowerIdx > 0 || upperIdx < bucketCount - 1)) {
      const nextLowerVol = lowerIdx > 0 ? buckets[lowerIdx - 1].volume : -1;
      const nextUpperVol = upperIdx < bucketCount - 1 ? buckets[upperIdx + 1].volume : -1;

      if (nextUpperVol >= nextLowerVol && upperIdx < bucketCount - 1) {
        upperIdx++;
        accumulatedVol += buckets[upperIdx].volume;
      } else if (lowerIdx > 0) {
        lowerIdx--;
        accumulatedVol += buckets[lowerIdx].volume;
      } else {
        break;
      }
    }

    const vahPrice = buckets[upperIdx]?.price || maxPrice;
    const valPrice = buckets[lowerIdx]?.price || minPrice;

    // Build levels array
    const levels: VolumeProfileLevel[] = buckets.map((b, i) => ({
      price: Number(b.price.toFixed(2)),
      volume: Math.round(b.volume),
      percentage: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0,
      isPoc: i === pocIndex,
      inValueArea: i >= lowerIdx && i <= upperIdx,
    }));

    return {
      pocPrice: Number(pocPrice.toFixed(2)),
      vahPrice: Number(vahPrice.toFixed(2)),
      valPrice: Number(valPrice.toFixed(2)),
      totalVolume: Math.round(totalVolume),
      levels,
    };
  }

  /**
   * Computes Previous Day High/Low (PDH/PDL) and intraday liquidity session levels.
   */
  public static calculateSessionLiquidity(candles: Candle[]): SessionLiquidityLevels {
    if (!candles || candles.length === 0) {
      return { pdh: 0, pdl: 0 };
    }

    // Identify candles from the previous 24h
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayCandles = candles.filter((c) => {
      const t = c.timestamp || (c.time ? new Date(c.time).getTime() : 0);
      return t >= now - 2 * oneDayMs && t <= now - oneDayMs;
    });

    const evalPool = yesterdayCandles.length > 5 ? yesterdayCandles : candles.slice(0, Math.min(24, candles.length));

    let pdh = -Infinity;
    let pdl = Infinity;
    evalPool.forEach((c) => {
      if (c.high > pdh) pdh = c.high;
      if (c.low < pdl) pdl = c.low;
    });

    // Session liquidity sweeps (Asian 00:00-08:00 UTC, London 07:00-15:30 UTC)
    let asianHigh = -Infinity;
    let asianLow = Infinity;
    let londonHigh = -Infinity;
    let londonLow = Infinity;

    candles.slice(-48).forEach((c) => {
      const date = c.timestamp ? new Date(c.timestamp) : new Date(c.time);
      const hour = date.getUTCHours();

      // Asian session: 0 - 8 UTC
      if (hour >= 0 && hour < 8) {
        if (c.high > asianHigh) asianHigh = c.high;
        if (c.low < asianLow) asianLow = c.low;
      }
      // London session: 7 - 16 UTC
      if (hour >= 7 && hour < 16) {
        if (c.high > londonHigh) londonHigh = c.high;
        if (c.low < londonLow) londonLow = c.low;
      }
    });

    return {
      pdh: pdh !== -Infinity ? Number(pdh.toFixed(2)) : 0,
      pdl: pdl !== Infinity ? Number(pdl.toFixed(2)) : 0,
      asianHigh: asianHigh !== -Infinity ? Number(asianHigh.toFixed(2)) : undefined,
      asianLow: asianLow !== Infinity ? Number(asianLow.toFixed(2)) : undefined,
      londonHigh: londonHigh !== -Infinity ? Number(londonHigh.toFixed(2)) : undefined,
      londonLow: londonLow !== Infinity ? Number(londonLow.toFixed(2)) : undefined,
    };
  }
}

export const calculateVolumeProfile = VolumeProfileEngine.calculateVPVR;
export const calculateSessionLiquidity = VolumeProfileEngine.calculateSessionLiquidity;
