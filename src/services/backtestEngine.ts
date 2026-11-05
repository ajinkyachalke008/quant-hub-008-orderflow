import { BacktestParams, BacktestResult, BacktestTrade, Candle } from '../types/terminal';
import { computeTechnicalIndicators } from './technicalAnalysis';

export class BacktestEngine {
  /**
   * Fetches real historical candles from Pyth Benchmarks TradingView API for zero-mock backtesting
   */
  public static async fetchHistoricalCandles(resolution: string = '60', limit: number = 500): Promise<Candle[]> {
    try {
      const now = Math.floor(Date.now() / 1000);
      let stepSeconds = 3600;
      if (resolution === '15') stepSeconds = 900;
      else if (resolution === '240') stepSeconds = 14400;
      else if (resolution === 'D') stepSeconds = 86400;

      const from = now - limit * stepSeconds;
      const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Metal.XAU/USD&resolution=${resolution}&from=${from}&to=${now}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
          const rawCandles: Candle[] = [];
          for (let i = 0; i < data.t.length; i++) {
            const date = new Date(data.t[i] * 1000);
            rawCandles.push({
              time: date.toISOString().slice(11, 16),
              timestamp: data.t[i] * 1000,
              open: +data.o[i].toFixed(2),
              high: +data.h[i].toFixed(2),
              low: +data.l[i].toFixed(2),
              close: +data.c[i].toFixed(2),
              volume: data.v ? +data.v[i].toFixed(2) : 100,
            });
          }
          return computeTechnicalIndicators(rawCandles);
        }
      }
    } catch (_) {
      // Automatic fallback to Binance Gold Spot klines
    }

    // Automatic Live Fallback: Binance Real Gold Spot (PAXGUSDT) OHLCV
    try {
      const intervalMap: Record<string, string> = {
        '15': '15m',
        '60': '1h',
        '240': '4h',
        'D': '1d',
      };
      const interval = intervalMap[resolution] || '1h';
      const klineUrl = `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${interval}&limit=${Math.min(limit, 500)}`;
      const resp = await fetch(klineUrl);
      if (resp.ok) {
        const data = await resp.json();
        const rawCandles: Candle[] = data.map((k: any) => {
          const date = new Date(k[0]);
          return {
            time: date.toISOString().slice(11, 16),
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          };
        });
        return computeTechnicalIndicators(rawCandles);
      }
    } catch (err) {
      console.warn('Real historical candle fallback failed:', err);
    }

    return [];
  }

  /**
   * Run strategy simulation over real historical candles
   */
  public static runBacktest(candles: Candle[], params: BacktestParams): BacktestResult {
    if (!candles || candles.length < 50) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        initialCapital: params.initialCapital,
        finalCapital: params.initialCapital,
        totalReturn: 0,
        totalReturnPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        profitFactor: 0,
        expectancy: 0,
        avgWin: 0,
        avgLoss: 0,
        equityCurve: [],
        trades: [],
      };
    }

    const n = candles.length;
    let equity = params.initialCapital;
    let peakEquity = equity;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    const trades: BacktestTrade[] = [];
    const equityCurve: { time: string; equity: number; drawdown: number }[] = [];
    const dailyReturns: number[] = [];

    let activePosition: {
      side: 'buy' | 'sell';
      entryPrice: number;
      entryTime: string;
      entryIndex: number;
      sl?: number;
      tp?: number;
    } | null = null;

    const OUNCES_PER_LOT = 100;
    const SPREAD = 0.35; // $0.35 institutional spread on Gold

    for (let i = 2; i < n; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      // 1. Check if active position hits SL or TP during current bar
      if (activePosition) {
        let closed = false;
        let exitPrice = curr.close;
        let reason: BacktestTrade['reason'] = 'signal';

        if (activePosition.side === 'buy') {
          if (activePosition.sl && curr.low <= activePosition.sl) {
            exitPrice = activePosition.sl;
            reason = 'sl';
            closed = true;
          } else if (activePosition.tp && curr.high >= activePosition.tp) {
            exitPrice = activePosition.tp;
            reason = 'tp';
            closed = true;
          }
        } else {
          if (activePosition.sl && curr.high >= activePosition.sl) {
            exitPrice = activePosition.sl;
            reason = 'sl';
            closed = true;
          } else if (activePosition.tp && curr.low <= activePosition.tp) {
            exitPrice = activePosition.tp;
            reason = 'tp';
            closed = true;
          }
        }

        if (closed) {
          const delta = (exitPrice - activePosition.entryPrice) * (activePosition.side === 'buy' ? 1 : -1) - SPREAD;
          const pnl = delta * params.lotSize * OUNCES_PER_LOT;
          const pnlPercent = (pnl / equity) * 100;
          equity += pnl;

          trades.push({
            id: `bt_${trades.length + 1}`,
            entryTime: activePosition.entryTime,
            exitTime: curr.time,
            side: activePosition.side,
            entryPrice: activePosition.entryPrice,
            exitPrice,
            pnl: +pnl.toFixed(2),
            pnlPercent: +pnlPercent.toFixed(2),
            reason,
          });

          dailyReturns.push(pnl / equity);
          activePosition = null;
        }
      }

      // 2. Evaluate Strategy Entry / Exit Signals
      let signal: 'buy' | 'sell' | 'exit' | null = null;

      if (params.strategy === 'sma_crossover') {
        const fastKey = params.fastPeriod === 20 ? 'sma20' : 'sma50';
        const slowKey = params.slowPeriod === 200 ? 'sma200' : 'sma50';
        const prevFast = prev[fastKey] ?? prev.close;
        const prevSlow = prev[slowKey] ?? prev.close;
        const currFast = curr[fastKey] ?? curr.close;
        const currSlow = curr[slowKey] ?? curr.close;

        if (prevFast <= prevSlow && currFast > currSlow) {
          signal = 'buy';
        } else if (prevFast >= prevSlow && currFast < currSlow) {
          signal = 'sell';
        }
      } else if (params.strategy === 'rsi_mean_reversion') {
        const oversold = params.rsiOversold ?? 30;
        const overbought = params.rsiOverbought ?? 70;
        const rsiCurr = curr.rsi ?? 50;
        const rsiPrev = prev.rsi ?? 50;

        if (rsiPrev < oversold && rsiCurr >= oversold) {
          signal = 'buy';
        } else if (rsiPrev > overbought && rsiCurr <= overbought) {
          signal = 'sell';
        } else if (activePosition && ((activePosition.side === 'buy' && rsiCurr > 50) || (activePosition.side === 'sell' && rsiCurr < 50))) {
          signal = 'exit';
        }
      } else if (params.strategy === 'macd_crossover') {
        const prevMacd = prev.macd?.macd ?? 0;
        const prevSig = prev.macd?.signal ?? 0;
        const currMacd = curr.macd?.macd ?? 0;
        const currSig = curr.macd?.signal ?? 0;

        if (prevMacd <= prevSig && currMacd > currSig) {
          signal = 'buy';
        } else if (prevMacd >= prevSig && currMacd < currSig) {
          signal = 'sell';
        }
      }

      // 3. Process Signals
      if (signal === 'exit' && activePosition) {
        const exitPrice = curr.close;
        const delta = (exitPrice - activePosition.entryPrice) * (activePosition.side === 'buy' ? 1 : -1) - SPREAD;
        const pnl = delta * params.lotSize * OUNCES_PER_LOT;
        equity += pnl;

        trades.push({
          id: `bt_${trades.length + 1}`,
          entryTime: activePosition.entryTime,
          exitTime: curr.time,
          side: activePosition.side,
          entryPrice: activePosition.entryPrice,
          exitPrice,
          pnl: +pnl.toFixed(2),
          pnlPercent: +((pnl / equity) * 100).toFixed(2),
          reason: 'signal',
        });

        dailyReturns.push(pnl / equity);
        activePosition = null;
      } else if ((signal === 'buy' || signal === 'sell') && (!activePosition || activePosition.side !== signal)) {
        // If opposite position active, close first
        if (activePosition) {
          const exitPrice = curr.close;
          const delta = (exitPrice - activePosition.entryPrice) * (activePosition.side === 'buy' ? 1 : -1) - SPREAD;
          const pnl = delta * params.lotSize * OUNCES_PER_LOT;
          equity += pnl;

          trades.push({
            id: `bt_${trades.length + 1}`,
            entryTime: activePosition.entryTime,
            exitTime: curr.time,
            side: activePosition.side,
            entryPrice: activePosition.entryPrice,
            exitPrice,
            pnl: +pnl.toFixed(2),
            pnlPercent: +((pnl / equity) * 100).toFixed(2),
            reason: 'reversal',
          });

          dailyReturns.push(pnl / equity);
          activePosition = null;
        }

        // Open new position
        const atr = curr.atr ?? 8.5;
        const atrMult = params.atrStopMult ?? 1.5;
        const slDist = atr * atrMult;

        activePosition = {
          side: signal,
          entryPrice: curr.close + (signal === 'buy' ? SPREAD / 2 : -SPREAD / 2),
          entryTime: curr.time,
          entryIndex: i,
          sl: signal === 'buy' ? +(curr.close - slDist).toFixed(2) : +(curr.close + slDist).toFixed(2),
          tp: signal === 'buy' ? +(curr.close + slDist * 2).toFixed(2) : +(curr.close - slDist * 2).toFixed(2),
        };
      }

      // Drawdown tracking
      if (equity > peakEquity) peakEquity = equity;
      const dd = peakEquity - equity;
      const ddPercent = (dd / peakEquity) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (ddPercent > maxDrawdownPercent) maxDrawdownPercent = ddPercent;

      equityCurve.push({
        time: curr.time,
        equity: +equity.toFixed(2),
        drawdown: +ddPercent.toFixed(2),
      });
    }

    // Performance Metrics Calculation
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);
    const winningTrades = wins.length;
    const losingTrades = losses.length;
    const winRate = totalTrades > 0 ? +((winningTrades / totalTrades) * 100).toFixed(2) : 0;

    const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 99.9 : 0;

    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const winProb = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const lossProb = totalTrades > 0 ? losingTrades / totalTrades : 0;
    const expectancy = +(winProb * avgWin - lossProb * avgLoss).toFixed(2);

    const totalReturn = +(equity - params.initialCapital).toFixed(2);
    const totalReturnPercent = +((totalReturn / params.initialCapital) * 100).toFixed(2);

    // Sharpe and Sortino Ratios (Annualized assuming 252 trading sessions)
    let sharpeRatio = 0;
    let sortinoRatio = 0;
    if (dailyReturns.length > 5) {
      const mean = dailyReturns.reduce((acc, r) => acc + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);

      const downsideDiffs = dailyReturns.filter((r) => r < 0);
      const downsideVariance =
        downsideDiffs.length > 0
          ? downsideDiffs.reduce((acc, r) => acc + Math.pow(r, 2), 0) / dailyReturns.length
          : 0.0001;
      const downsideStdDev = Math.sqrt(downsideVariance);

      if (stdDev > 0) {
        sharpeRatio = +((mean / stdDev) * Math.sqrt(252)).toFixed(2);
      }
      if (downsideStdDev > 0) {
        sortinoRatio = +((mean / downsideStdDev) * Math.sqrt(252)).toFixed(2);
      }
    }

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      initialCapital: params.initialCapital,
      finalCapital: +equity.toFixed(2),
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: +maxDrawdown.toFixed(2),
      maxDrawdownPercent: +maxDrawdownPercent.toFixed(2),
      profitFactor,
      expectancy,
      avgWin: +avgWin.toFixed(2),
      avgLoss: +avgLoss.toFixed(2),
      equityCurve,
      trades,
    };
  }
}
