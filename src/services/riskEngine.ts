import {
  Candle,
  PaperPosition,
  RiskProfileSummary,
  StressTestScenario,
  VaRMetric,
} from '../types/terminal';

/**
 * Advanced Institutional Risk Management & Value-at-Risk (VaR) Engine
 *
 * Implements rigorous quantitative financial risk models:
 * 1. Parametric VaR (Normal Variance-Covariance) at 95% and 99% 1-day horizon
 * 2. Historical Simulation VaR (Empirical Quantiles) and Expected Shortfall (CVaR / Tail Risk)
 * 3. Extreme Macroeconomic Scenario Stress Testing (+$100 Bullion Spike, -$150 Flash Crash, Rate Shocks)
 * 4. Dynamic Liquidation Price & Margin Call Vulnerability Forecasting
 */
export class RiskEngine {
  private static readonly Z_95 = 1.64485;
  private static readonly Z_99 = 2.32635;
  private static readonly OUNCES_PER_LOT = 100;

  /**
   * Evaluates complete portfolio risk profile from active positions, equity, and historical candles
   */
  public static evaluatePortfolioRisk(
    positions: PaperPosition[],
    accountEquity: number,
    candles: Candle[] = []
  ): RiskProfileSummary {
    const safeEquity = Math.max(1, accountEquity);

    // Compute gross exposure and margin used
    let grossExposureDollars = 0;
    let netDeltaExposure = 0; // Net long vs short delta
    let totalMarginUsed = 0;

    positions.forEach((pos) => {
      const positionValue = pos.lots * this.OUNCES_PER_LOT * pos.currentPrice;
      grossExposureDollars += positionValue;
      if (pos.side === 'buy') {
        netDeltaExposure += positionValue;
      } else {
        netDeltaExposure -= positionValue;
      }
      totalMarginUsed += pos.marginUsed || positionValue / 50;
    });

    const freeMargin = Math.max(0, safeEquity - totalMarginUsed);
    const marginUtilizationPct = Number(((totalMarginUsed / safeEquity) * 100).toFixed(2));
    const effectiveLeverage = Number((grossExposureDollars / safeEquity).toFixed(2));

    // Daily historical volatility computed from live candle series
    const dailyVol = this.computeDailyVolatility(candles);

    // Compute Parametric and Historical VaR
    const var95 = this.calculateVaR(netDeltaExposure, safeEquity, dailyVol, 95, candles);
    const var99 = this.calculateVaR(netDeltaExposure, safeEquity, dailyVol, 99, candles);

    // Compute Extreme Macroeconomic Stress Scenarios
    const stressTests = this.runStressScenarios(positions, safeEquity, totalMarginUsed);

    // Calculate approximate liquidation threshold prices
    const { liquidationLong, liquidationShort } = this.calculateLiquidationLevels(positions, safeEquity);

    return {
      portfolioEquity: Number(safeEquity.toFixed(2)),
      freeMargin: Number(freeMargin.toFixed(2)),
      marginUtilizationPct,
      effectiveLeverage,
      dailyParametricVaR95: var95,
      dailyParametricVaR99: var99,
      stressTests,
      liquidationPriceLong: liquidationLong,
      liquidationPriceShort: liquidationShort,
    };
  }

  /**
   * Computes annualized and 1-day logarithmic return volatility from real OHLCV bars
   */
  public static computeDailyVolatility(candles: Candle[]): number {
    if (!candles || candles.length < 5) {
      return 0.0125; // 1.25% standard 1-day bullion volatility baseline
    }

    const logReturns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      const curr = candles[i].close;
      if (prev > 0 && curr > 0) {
        logReturns.push(Math.log(curr / prev));
      }
    }

    if (logReturns.length === 0) return 0.0125;

    const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
    const variance =
      logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);

    const stdDev = Math.sqrt(variance);
    return Math.max(0.005, stdDev);
  }

  /**
   * Calculates 1-day VaR & Expected Shortfall (CVaR)
   */
  private static calculateVaR(
    netExposure: number,
    equity: number,
    dailyVol: number,
    confidence: 95 | 99,
    candles: Candle[]
  ): VaRMetric {
    const absExposure = Math.abs(netExposure);
    const zScore = confidence === 95 ? this.Z_95 : this.Z_99;

    // 1. Parametric VaR = NetExposure * Z * Volatility
    const parametricDollars = absExposure > 0 ? absExposure * zScore * dailyVol : 0;
    const parametricPct = equity > 0 ? (parametricDollars / equity) * 100 : 0;

    // 2. Historical Simulation VaR & Expected Shortfall (CVaR)
    let historicalDollars = parametricDollars * 1.05; // default fallback if candle history is short
    let expectedShortfallDollars = parametricDollars * 1.25;

    if (candles && candles.length >= 20 && absExposure > 0) {
      const returns: number[] = [];
      for (let i = 1; i < candles.length; i++) {
        returns.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
      }
      returns.sort((a, b) => a - b); // ascending losses first

      const alpha = (100 - confidence) / 100;
      const cutoffIndex = Math.max(0, Math.floor(returns.length * alpha));
      const quantileLossReturn = Math.abs(returns[cutoffIndex] || dailyVol * zScore);

      historicalDollars = absExposure * quantileLossReturn;

      // Expected Shortfall: average of all returns beyond quantile cutoff
      const tailReturns = returns.slice(0, Math.max(1, cutoffIndex + 1));
      const avgTailLoss =
        tailReturns.reduce((acc, r) => acc + Math.abs(r), 0) / tailReturns.length;
      expectedShortfallDollars = absExposure * avgTailLoss;
    }

    const historicalPct = equity > 0 ? (historicalDollars / equity) * 100 : 0;
    const expectedShortfallPct = equity > 0 ? (expectedShortfallDollars / equity) * 100 : 0;

    return {
      confidence,
      horizonDays: 1,
      parametricVaRDollars: Number(parametricDollars.toFixed(2)),
      parametricVaRPct: Number(parametricPct.toFixed(2)),
      historicalVaRDollars: Number(historicalDollars.toFixed(2)),
      historicalVaRPct: Number(historicalPct.toFixed(2)),
      expectedShortfallDollars: Number(expectedShortfallDollars.toFixed(2)),
      expectedShortfallPct: Number(expectedShortfallPct.toFixed(2)),
      portfolioVolatilityPct: Number((dailyVol * 100).toFixed(2)),
    };
  }

  /**
   * Simulates portfolio resilience across 5 predefined institutional macro stress scenarios
   */
  public static runStressScenarios(
    positions: PaperPosition[],
    equity: number,
    marginUsed: number
  ): StressTestScenario[] {
    const scenarios: Omit<StressTestScenario, 'projectedPortfolioPnL' | 'projectedPortfolioPnLPct' | 'marginCallRisk' | 'postShockMarginRatio'>[] = [
      {
        id: 'gold_spike_100',
        name: '+$100 Bullion Geopolitical Spike',
        category: 'GEOPOLITICAL',
        description: 'Instant flight-to-safety surge: Gold Spot spikes +$100.00 (+2.5%), crude oil +4%, USD softens.',
        goldShockPct: 2.47,
        equityShockPct: -1.8,
        cryptoShockPct: 1.2,
        spreadMultiplier: 2.5,
      },
      {
        id: 'flash_crash_150',
        name: '-$150 Bullion Liquidation Flash Crash',
        category: 'LIQUIDITY',
        description: 'Coordinated margin cascades across COMEX futures: Gold Spot drops -$150.00 (-3.7%), liquidity thins.',
        goldShockPct: -3.71,
        equityShockPct: -2.5,
        cryptoShockPct: -5.4,
        spreadMultiplier: 4.0,
      },
      {
        id: 'fomc_50bps_hike',
        name: 'FOMC Unexpected 50bps Rate Shock',
        category: 'MONETARY',
        description: 'Aggressive hawkish pivot: US Dollar Index (DXY) surges +1.8%, 10Y Treasury yield spikes, Gold plunges -2.2%.',
        goldShockPct: -2.20,
        equityShockPct: -3.2,
        cryptoShockPct: -4.0,
        spreadMultiplier: 3.0,
      },
      {
        id: 'liquidity_freeze',
        name: 'LBMA / COMEX Liquidity Freeze',
        category: 'LIQUIDITY',
        description: 'Market makers pull quotes: Bid/Ask spread blows out 10x ($0.10 -> $1.00), severe execution slippage.',
        goldShockPct: -0.80,
        equityShockPct: -1.0,
        cryptoShockPct: -2.0,
        spreadMultiplier: 10.0,
      },
      {
        id: 'stagflation_shock',
        name: '1970s Style Stagflation Black Swan',
        category: 'MACRO',
        description: 'Persistent inflation print with stagnant GDP: Bullion rockets +8.5%, equities sell off -6%, yields spike.',
        goldShockPct: 8.50,
        equityShockPct: -6.0,
        cryptoShockPct: -8.0,
        spreadMultiplier: 3.5,
      },
    ];

    return scenarios.map((sc) => {
      let pnlDollars = 0;

      positions.forEach((pos) => {
        const spotPrice = pos.currentPrice;
        const shockedPrice = spotPrice * (1 + sc.goldShockPct / 100);
        const priceDiff = pos.side === 'buy' ? shockedPrice - spotPrice : spotPrice - shockedPrice;
        pnlDollars += priceDiff * pos.lots * this.OUNCES_PER_LOT;
      });

      const pnlPct = equity > 0 ? (pnlDollars / equity) * 100 : 0;
      const postShockEquity = equity + pnlDollars;
      const postShockMarginRatio = postShockEquity > 0 ? (marginUsed / postShockEquity) * 100 : 999;

      let marginCallRisk: 'LOW' | 'ELEVATED' | 'CRITICAL' = 'LOW';
      if (postShockEquity <= 0 || postShockMarginRatio >= 100) {
        marginCallRisk = 'CRITICAL';
      } else if (postShockMarginRatio >= 70 || pnlPct <= -20) {
        marginCallRisk = 'ELEVATED';
      }

      return {
        ...sc,
        projectedPortfolioPnL: Number(pnlDollars.toFixed(2)),
        projectedPortfolioPnLPct: Number(pnlPct.toFixed(2)),
        marginCallRisk,
        postShockMarginRatio: Number(Math.min(999, postShockMarginRatio).toFixed(1)),
      };
    });
  }

  /**
   * Forecasts account liquidation prices for open long and short positions
   */
  private static calculateLiquidationLevels(
    positions: PaperPosition[],
    equity: number
  ): { liquidationLong?: number; liquidationShort?: number } {
    let longLots = 0;
    let shortLots = 0;
    let longAvg = 0;
    let shortAvg = 0;

    positions.forEach((p) => {
      if (p.side === 'buy') {
        longAvg = (longAvg * longLots + p.currentPrice * p.lots) / (longLots + p.lots);
        longLots += p.lots;
      } else {
        shortAvg = (shortAvg * shortLots + p.currentPrice * p.lots) / (shortLots + p.lots);
        shortLots += p.lots;
      }
    });

    let liquidationLong: number | undefined;
    let liquidationShort: number | undefined;

    // Maintenance margin is 50% of initial margin (or 1% of exposure)
    if (longLots > 0) {
      // Loss required to wipe equity down to maintenance margin:
      const maxTolerableLoss = equity * 0.95;
      const dropPerOz = maxTolerableLoss / (longLots * this.OUNCES_PER_LOT);
      liquidationLong = Number(Math.max(0, longAvg - dropPerOz).toFixed(2));
    }

    if (shortLots > 0) {
      const maxTolerableLoss = equity * 0.95;
      const risePerOz = maxTolerableLoss / (shortLots * this.OUNCES_PER_LOT);
      liquidationShort = Number((shortAvg + risePerOz).toFixed(2));
    }

    return { liquidationLong, liquidationShort };
  }
}
