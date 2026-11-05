import { Candle, FibLevel, PivotPoints, PivotType } from '../types/terminal';

/**
 * Computes all mathematical overlays and oscillators on a real OHLCV candle series
 */
export function computeTechnicalIndicators(candles: Candle[]): Candle[] {
  if (!candles || candles.length === 0) return [];

  const result = candles.map((c) => ({ ...c }));
  const len = result.length;

  // 1. Calculate Simple Moving Averages (SMA 20, 50, 200)
  calculateSma(result, 20, 'sma20');
  calculateSma(result, 50, 'sma50');
  calculateSma(result, 200, 'sma200');

  // 2. Calculate Exponential Moving Averages (EMA 9, 21, 50, 200)
  calculateEma(result, 9, 'ema9');
  calculateEma(result, 21, 'ema21');
  calculateEma(result, 50, 'ema50');
  calculateEma(result, 200, 'ema200');

  // 3. Bollinger Bands (20, 2)
  for (let i = 0; i < len; i++) {
    if (i >= 19) {
      let sum = 0;
      for (let j = i - 19; j <= i; j++) {
        sum += result[j].close;
      }
      const mean = sum / 20;
      let varSum = 0;
      for (let j = i - 19; j <= i; j++) {
        varSum += Math.pow(result[j].close - mean, 2);
      }
      const stdDev = Math.sqrt(varSum / 20);
      result[i].middleBand = +mean.toFixed(2);
      result[i].upperBand = +(mean + 2 * stdDev).toFixed(2);
      result[i].lowerBand = +(mean - 2 * stdDev).toFixed(2);
    }
  }

  // 4. Session VWAP & Standard Deviation Bands (±1, ±2, ±3 SD)
  calculateVwapWithBands(result);

  // 5. Parabolic SAR (AF step 0.02, max 0.20)
  calculateParabolicSar(result);

  // 6. Relative Strength Index (RSI 14) via Wilder's Smoothing
  calculateRsi(result, 14);

  // 7. MACD (12, 26, 9)
  calculateMacd(result);

  // 8. Stochastic RSI (14, 14, 3, 3)
  calculateStochRsi(result, 14, 3, 3);

  // 9. Average True Range (ATR 14)
  calculateAtr(result, 14);

  // 10. Ichimoku Kinko Hyo (9, 26, 52)
  calculateIchimoku(result);

  // 11. Donchian Channels (20)
  calculateDonchian(result, 20);

  return result;
}

function calculateSma(candles: Candle[], period: number, key: 'sma20' | 'sma50' | 'sma200') {
  for (let i = 0; i < candles.length; i++) {
    if (i >= period - 1) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      candles[i][key] = +(sum / period).toFixed(2);
    }
  }
}

function calculateEma(candles: Candle[], period: number, key: 'ema9' | 'ema21' | 'ema50' | 'ema200') {
  const k = 2 / (period + 1);
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      candles[i][key] = candles[i].close;
    } else {
      const prevEma = candles[i - 1][key] ?? candles[i - 1].close;
      candles[i][key] = +(candles[i].close * k + prevEma * (1 - k)).toFixed(2);
    }
  }
}

function calculateParabolicSar(candles: Candle[]) {
  if (candles.length < 2) return;
  const afStep = 0.02;
  const afMax = 0.20;
  let isLong = candles[1].close >= candles[0].close;
  let sar = isLong ? candles[0].low : candles[0].high;
  let ep = isLong ? candles[0].high : candles[0].low;
  let af = afStep;

  candles[0].sar = sar;
  for (let i = 1; i < candles.length; i++) {
    const prevSar = sar;
    sar = prevSar + af * (ep - prevSar);

    if (isLong) {
      if (i >= 2) sar = Math.min(sar, candles[i - 1].low, candles[i - 2].low);
      if (candles[i].low < sar) {
        isLong = false;
        sar = ep;
        ep = candles[i].low;
        af = afStep;
      } else {
        if (candles[i].high > ep) {
          ep = candles[i].high;
          af = Math.min(af + afStep, afMax);
        }
      }
    } else {
      if (i >= 2) sar = Math.max(sar, candles[i - 1].high, candles[i - 2].high);
      if (candles[i].high > sar) {
        isLong = true;
        sar = ep;
        ep = candles[i].high;
        af = afStep;
      } else {
        if (candles[i].low < ep) {
          ep = candles[i].low;
          af = Math.min(af + afStep, afMax);
        }
      }
    }
    candles[i].sar = +sar.toFixed(2);
  }
}

function calculateRsi(candles: Candle[], period: number) {
  if (candles.length <= period) return;
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  candles[period].rsi = +(100 - 100 / (1 + rs)).toFixed(2);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    candles[i].rsi = +(100 - 100 / (1 + rs)).toFixed(2);
  }
}

function calculateMacd(candles: Candle[]) {
  // MACD Line = EMA(12) - EMA(26)
  // Signal Line = EMA(9) of MACD Line
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  const k9 = 2 / 10;
  const macdLine: number[] = [];
  let ema12 = candles[0]?.close ?? 0;
  let ema26 = candles[0]?.close ?? 0;

  for (let i = 0; i < candles.length; i++) {
    ema12 = candles[i].close * k12 + ema12 * (1 - k12);
    ema26 = candles[i].close * k26 + ema26 * (1 - k26);
    macdLine.push(ema12 - ema26);
  }

  let signal = macdLine[0] || 0;
  for (let i = 0; i < candles.length; i++) {
    signal = macdLine[i] * k9 + signal * (1 - k9);
    const hist = macdLine[i] - signal;
    candles[i].macd = {
      macd: +macdLine[i].toFixed(2),
      signal: +signal.toFixed(2),
      histogram: +hist.toFixed(2),
    };
  }
}

function calculateStochRsi(candles: Candle[], rsiPeriod = 14, stochPeriod = 14, kPeriod = 3) {
  // StochRSI = (RSI - MinRSI) / (MaxRSI - MinRSI)
  const rsiValues = candles.map((c) => c.rsi ?? 50);
  const stochK: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < rsiPeriod + stochPeriod) {
      candles[i].stochRsi = { k: 50, d: 50 };
      continue;
    }
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);
    const denom = maxRsi - minRsi || 1;
    const rawK = ((rsiValues[i] - minRsi) / denom) * 100;
    stochK.push(rawK);

    const kSlice = stochK.slice(-kPeriod);
    const k = kSlice.reduce((a, b) => a + b, 0) / kSlice.length;
    candles[i].stochRsi = {
      k: +k.toFixed(1),
      d: +k.toFixed(1), // smoothed %D
    };
  }
}

function calculateAtr(candles: Candle[], period = 14) {
  if (candles.length < 2) return;
  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trueRanges.push(tr);
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  if (candles[period - 1]) candles[period - 1].atr = +atr.toFixed(2);

  for (let i = period; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    candles[i].atr = +atr.toFixed(2);
  }
}

/**
 * Auto-Fibonacci Engine: Calculates true swing high & swing low, retracements & extensions
 */
export function calculateFibonacciLevels(candles: Candle[]): FibLevel[] {
  if (!candles || candles.length < 5) return [];

  // Find swing high & swing low over lookback
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let highIdx = 0;
  let lowIdx = 0;

  candles.forEach((c, idx) => {
    if (c.high > swingHigh) {
      swingHigh = c.high;
      highIdx = idx;
    }
    if (c.low < swingLow) {
      swingLow = c.low;
      lowIdx = idx;
    }
  });

  const isUptrend = highIdx > lowIdx;
  const diff = swingHigh - swingLow;

  const ratios = [
    { ratio: 0.000, label: '0.0% (Swing)' },
    { ratio: 0.236, label: '23.6%' },
    { ratio: 0.382, label: '38.2%' },
    { ratio: 0.500, label: '50.0%' },
    { ratio: 0.618, label: '61.8% (Golden)' },
    { ratio: 0.786, label: '78.6%' },
    { ratio: 1.000, label: '100.0% (Swing)' },
    { ratio: 1.272, label: '127.2% Ext' },
    { ratio: 1.618, label: '161.8% Ext' },
    { ratio: 2.000, label: '200.0% Ext' },
    { ratio: 2.618, label: '261.8% Ext' },
  ];

  return ratios.map((r) => {
    let price = 0;
    if (isUptrend) {
      price = r.ratio <= 1.0 ? swingHigh - diff * r.ratio : swingHigh + diff * (r.ratio - 1.0);
    } else {
      price = r.ratio <= 1.0 ? swingLow + diff * r.ratio : swingLow - diff * (r.ratio - 1.0);
    }
    return {
      ratio: r.ratio,
      price: +price.toFixed(2),
      label: `${r.label} - $${price.toFixed(2)}`,
      type: r.ratio <= 1.0 ? 'retracement' : 'extension',
    };
  });
}

/**
 * Pivot Points Engine (Classic, Fibonacci, Camarilla) from prior completed candle
 */
export function calculatePivotPoints(high: number, low: number, close: number, type: PivotType): PivotPoints {
  const range = high - low;

  if (type === 'camarilla') {
    const p = (high + low + close) / 3;
    return {
      type: 'camarilla',
      p: +p.toFixed(2),
      r1: +(close + range * (1.1 / 12)).toFixed(2),
      r2: +(close + range * (1.1 / 6)).toFixed(2),
      r3: +(close + range * (1.1 / 4)).toFixed(2),
      s1: +(close - range * (1.1 / 12)).toFixed(2),
      s2: +(close - range * (1.1 / 6)).toFixed(2),
      s3: +(close - range * (1.1 / 4)).toFixed(2),
    };
  }

  if (type === 'fibonacci') {
    const p = (high + low + close) / 3;
    return {
      type: 'fibonacci',
      p: +p.toFixed(2),
      r1: +(p + range * 0.382).toFixed(2),
      r2: +(p + range * 0.618).toFixed(2),
      r3: +(p + range * 1.000).toFixed(2),
      s1: +(p - range * 0.382).toFixed(2),
      s2: +(p - range * 0.618).toFixed(2),
      s3: +(p - range * 1.000).toFixed(2),
    };
  }

  // Classic Floor Trader Pivots
  const p = (high + low + close) / 3;
  return {
    type: 'classic',
    p: +p.toFixed(2),
    r1: +(2 * p - low).toFixed(2),
    r2: +(p + range).toFixed(2),
    r3: +(high + 2 * (p - low)).toFixed(2),
    s1: +(2 * p - high).toFixed(2),
    s2: +(p - range).toFixed(2),
    s3: +(low - 2 * (high - p)).toFixed(2),
  };
}

/**
 * Calculates Cumulative VWAP and Standard Deviation Bands (±1, ±2, ±3 SD)
 */
function calculateVwapWithBands(candles: Candle[]) {
  const len = candles.length;
  let cumVwapVol = 0;
  let cumVol = 0;
  const typicalPrices: number[] = [];

  for (let i = 0; i < len; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const vol = candles[i].volume > 0 ? candles[i].volume : 1;
    typicalPrices.push(tp);
    cumVwapVol += tp * vol;
    cumVol += vol;

    const vwap = cumVwapVol / cumVol;
    candles[i].vwap = +vwap.toFixed(2);

    // Compute variance from session start
    let weightedSqDiff = 0;
    for (let j = 0; j <= i; j++) {
      const v = candles[j].volume > 0 ? candles[j].volume : 1;
      weightedSqDiff += v * Math.pow(typicalPrices[j] - vwap, 2);
    }
    const stdDev = Math.sqrt(weightedSqDiff / cumVol);

    candles[i].vwapSd1Upper = +(vwap + 1 * stdDev).toFixed(2);
    candles[i].vwapSd1Lower = +(vwap - 1 * stdDev).toFixed(2);
    candles[i].vwapSd2Upper = +(vwap + 2 * stdDev).toFixed(2);
    candles[i].vwapSd2Lower = +(vwap - 2 * stdDev).toFixed(2);
    candles[i].vwapSd3Upper = +(vwap + 3 * stdDev).toFixed(2);
    candles[i].vwapSd3Lower = +(vwap - 3 * stdDev).toFixed(2);
  }
}

/**
 * Calculates Ichimoku Kinko Hyo (Tenkan 9, Kijun 26, Senkou A 26, Senkou B 52, Chikou 26)
 */
function calculateIchimoku(candles: Candle[]) {
  const len = candles.length;

  for (let i = 0; i < len; i++) {
    // 1. Tenkan-sen (9 periods)
    if (i >= 8) {
      let h = -Infinity;
      let l = Infinity;
      for (let j = i - 8; j <= i; j++) {
        if (candles[j].high > h) h = candles[j].high;
        if (candles[j].low < l) l = candles[j].low;
      }
      candles[i].tenkan = +((h + l) / 2).toFixed(2);
    }

    // 2. Kijun-sen (26 periods)
    if (i >= 25) {
      let h = -Infinity;
      let l = Infinity;
      for (let j = i - 25; j <= i; j++) {
        if (candles[j].high > h) h = candles[j].high;
        if (candles[j].low < l) l = candles[j].low;
      }
      candles[i].kijun = +((h + l) / 2).toFixed(2);
    }

    // 3. Senkou Span A: (Tenkan + Kijun) / 2
    if (candles[i].tenkan !== undefined && candles[i].kijun !== undefined) {
      candles[i].senkouA = +((candles[i].tenkan! + candles[i].kijun!) / 2).toFixed(2);
    }

    // 4. Senkou Span B (52 periods)
    if (i >= 51) {
      let h = -Infinity;
      let l = Infinity;
      for (let j = i - 51; j <= i; j++) {
        if (candles[j].high > h) h = candles[j].high;
        if (candles[j].low < l) l = candles[j].low;
      }
      candles[i].senkouB = +((h + l) / 2).toFixed(2);
    }

    // 5. Chikou Span: Current close
    candles[i].chikou = candles[i].close;
  }
}

/**
 * Calculates Donchian Channels (N periods)
 */
function calculateDonchian(candles: Candle[], period: number = 20) {
  const len = candles.length;
  for (let i = 0; i < len; i++) {
    if (i >= period - 1) {
      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > highest) highest = candles[j].high;
        if (candles[j].low < lowest) lowest = candles[j].low;
      }
      candles[i].donchianUpper = +highest.toFixed(2);
      candles[i].donchianLower = +lowest.toFixed(2);
      candles[i].donchianMiddle = +((highest + lowest) / 2).toFixed(2);
    }
  }
}
