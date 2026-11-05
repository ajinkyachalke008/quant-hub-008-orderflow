// OpenTerminal Institutional Strategy Web Worker
// Performs background statistical computations and signal triggers off the main UI thread

interface StrategyTickPayload {
  price: number;
  timestamp: number;
  vwap?: number;
  vwapSd?: number;
  pdh?: number;
  pdl?: number;
  volume?: number;
  avgVolume?: number;
}

interface WorkerConfig {
  vwapReversionEnabled: boolean;
  momentumBreakoutEnabled: boolean;
  vwapSdThreshold: number; // e.g. 1.5
  volumeMultiplier: number; // e.g. 1.3
}

let config: WorkerConfig = {
  vwapReversionEnabled: true,
  momentumBreakoutEnabled: true,
  vwapSdThreshold: 1.5,
  volumeMultiplier: 1.3,
};

let lastSignalTime = 0;
const SIGNAL_COOLDOWN_MS = 60000; // 1 minute cooldown between automated entries

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'CONFIG') {
    config = { ...config, ...payload };
    self.postMessage({ type: 'LOG', message: 'Strategy Worker config updated.' });
  } else if (type === 'EVALUATE_TICK') {
    const tick: StrategyTickPayload = payload;
    const now = Date.now();
    if (now - lastSignalTime < SIGNAL_COOLDOWN_MS) return;

    // 1. Evaluate VWAP Reversion Strategy
    if (config.vwapReversionEnabled && tick.vwap && tick.vwapSd && tick.vwapSd > 0) {
      const zScore = (tick.price - tick.vwap) / tick.vwapSd;

      if (zScore <= -config.vwapSdThreshold) {
        lastSignalTime = now;
        self.postMessage({
          type: 'ORDER_SIGNAL',
          strategy: 'vwap_reversion',
          side: 'buy',
          price: tick.price,
          reason: `VWAP Oversold Deviation (Z: ${zScore.toFixed(2)} SD below Session VWAP)`,
          sl: +(tick.price - tick.vwapSd * 1.5).toFixed(2),
          tp: +(tick.vwap).toFixed(2),
        });
        return;
      } else if (zScore >= config.vwapSdThreshold) {
        lastSignalTime = now;
        self.postMessage({
          type: 'ORDER_SIGNAL',
          strategy: 'vwap_reversion',
          side: 'sell',
          price: tick.price,
          reason: `VWAP Overbought Deviation (Z: +${zScore.toFixed(2)} SD above Session VWAP)`,
          sl: +(tick.price + tick.vwapSd * 1.5).toFixed(2),
          tp: +(tick.vwap).toFixed(2),
        });
        return;
      }
    }

    // 2. Evaluate Momentum Breakout Strategy
    if (config.momentumBreakoutEnabled && tick.pdh && tick.pdl && tick.volume && tick.avgVolume) {
      const volExpansion = tick.volume >= tick.avgVolume * config.volumeMultiplier;

      if (tick.price > tick.pdh && volExpansion) {
        lastSignalTime = now;
        self.postMessage({
          type: 'ORDER_SIGNAL',
          strategy: 'momentum_breakout',
          side: 'buy',
          price: tick.price,
          reason: `PDH Institutional Breakout with Volume Surge (${(tick.volume / tick.avgVolume).toFixed(1)}x Avg Vol)`,
          sl: +(tick.pdh - 4.5).toFixed(2),
          tp: +(tick.price + 12.0).toFixed(2),
        });
      } else if (tick.price < tick.pdl && volExpansion) {
        lastSignalTime = now;
        self.postMessage({
          type: 'ORDER_SIGNAL',
          strategy: 'momentum_breakout',
          side: 'sell',
          price: tick.price,
          reason: `PDL Institutional Breakdown with Volume Surge (${(tick.volume / tick.avgVolume).toFixed(1)}x Avg Vol)`,
          sl: +(tick.pdl + 4.5).toFixed(2),
          tp: +(tick.price - 12.0).toFixed(2),
        });
      }
    }
  }
};
