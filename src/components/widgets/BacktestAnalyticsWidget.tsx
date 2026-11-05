import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Download,
  TrendingUp,
  ShieldAlert,
  Percent,
  Activity,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { BacktestEngine } from '../../services/backtestEngine';
import { xauusdDataService } from '../../services/xauusdDataService';
import { BacktestParams, BacktestResult, Timeframe } from '../../types/terminal';

export const BacktestAnalyticsWidget: React.FC = () => {
  const [strategy, setStrategy] = useState<BacktestParams['strategy']>('sma_crossover');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [lotSize, setLotSize] = useState<number>(1.0);
  const [fastPeriod, setFastPeriod] = useState<number>(20);
  const [slowPeriod, setSlowPeriod] = useState<number>(50);
  const [rsiOversold, setRsiOversold] = useState<number>(30);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [atrStopMult, setAtrStopMult] = useState<number>(1.5);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [candleCount, setCandleCount] = useState<number>(0);

  const runSimulation = async () => {
    setIsLoading(true);
    try {
      const resolutionMap: Record<string, string> = {
        '15m': '15',
        '1h': '60',
        '4h': '240',
        '1D': 'D',
      };
      const resCode = resolutionMap[timeframe] || '60';

      // 1. Fetch real historical candles from Pyth Benchmarks API
      let candles = await BacktestEngine.fetchHistoricalCandles(resCode, 500);

      // Fallback to active service candles if API unreachable
      if (!candles || candles.length < 50) {
        candles = xauusdDataService.getCandles();
      }

      setCandleCount(candles.length);

      const params: BacktestParams = {
        strategy,
        timeframe,
        fastPeriod,
        slowPeriod,
        rsiOversold,
        rsiOverbought,
        atrStopMult,
        initialCapital,
        lotSize,
      };

      const res = BacktestEngine.runBacktest(candles, params);
      setResult(res);
    } catch (e) {
      console.error('Backtest error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [strategy, timeframe]);

  const exportCsv = () => {
    if (!result || result.trades.length === 0) return;
    const headers = ['ID', 'Entry Time', 'Exit Time', 'Side', 'Entry Price', 'Exit Price', 'PnL ($)', 'PnL (%)', 'Reason'];
    const rows = result.trades.map((t) => [
      t.id,
      t.entryTime,
      t.exitTime,
      t.side.toUpperCase(),
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.pnl.toFixed(2),
      t.pnlPercent.toFixed(2),
      t.reason.toUpperCase(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `openterminal_backtest_${strategy}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Top Controls Header */}
      <div className="p-3 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[var(--accent-amber)] font-bold uppercase tracking-wider text-sm">
            <Activity className="w-4 h-4 text-[var(--accent-cyan)]" />
            <span>Strategy Backtester</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Pyth Benchmark Data ({candleCount} bars)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runSimulation}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-cyan)]/20 hover:bg-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/50 font-bold transition-all disabled:opacity-50"
          >
            {isLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>RUN TEST</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={!result || result.trades.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-color)] hover:bg-[var(--surface-elevated)] text-[var(--text-color)] border border-[var(--border-color)] transition-all disabled:opacity-40"
            title="Download Trades CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Parameter Ribbon */}
      <div className="px-3 py-2 bg-[var(--surface-color)] border-b border-[var(--border-color)] grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as any)}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] focus:border-[var(--accent-cyan)] outline-none"
          >
            <option value="sma_crossover">Golden/Death Cross (SMA 50/200)</option>
            <option value="rsi_mean_reversion">RSI Mean Reversion (30/70)</option>
            <option value="macd_crossover">MACD Zero & Signal Cross</option>
          </select>
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">Timeframe</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] focus:border-[var(--accent-cyan)] outline-none"
          >
            <option value="15m">15 Minutes (Tactical)</option>
            <option value="1h">1 Hour (Standard)</option>
            <option value="4h">4 Hours (Swing)</option>
            <option value="1D">1 Day (Macro)</option>
          </select>
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">Capital ($)</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(Math.max(1000, Number(e.target.value)))}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
          />
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">Lot Size (100oz)</label>
          <input
            type="number"
            step="0.1"
            value={lotSize}
            onChange={(e) => setLotSize(Math.max(0.1, Number(e.target.value)))}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
          />
        </div>

        <div>
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">ATR SL Multiplier</label>
          <input
            type="number"
            step="0.1"
            value={atrStopMult}
            onChange={(e) => setAtrStopMult(Math.max(0.5, Number(e.target.value)))}
            className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
          />
        </div>
      </div>

      {/* Analytics KPI Ribbon */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 bg-[var(--surface-elevated)]/40 border-b border-[var(--border-color)]">
          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Total Return</span>
            <span className={`text-sm font-bold ${result.totalReturn >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
              {result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toLocaleString()} ({result.totalReturnPercent}%)
            </span>
          </div>

          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Sharpe / Sortino</span>
            <div className="text-sm font-bold text-[var(--accent-cyan)] flex items-center gap-1">
              <span>{result.sharpeRatio}</span>
              <span className="text-[var(--text-muted)] font-normal text-xs">/ {result.sortinoRatio}</span>
            </div>
          </div>

          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Max Drawdown</span>
            <span className="text-sm font-bold text-[#FF5252]">
              -{result.maxDrawdownPercent}% (${result.maxDrawdown.toLocaleString()})
            </span>
          </div>

          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Win Rate</span>
            <span className="text-sm font-bold text-[var(--accent-amber)]">
              {result.winRate}% ({result.winningTrades}W / {result.losingTrades}L)
            </span>
          </div>

          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Profit Factor</span>
            <span className="text-sm font-bold text-[var(--accent-emerald)]">{result.profitFactor}</span>
          </div>

          <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Expectancy / Trade</span>
            <span className={`text-sm font-bold ${result.expectancy >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
              {result.expectancy >= 0 ? '+' : ''}${result.expectancy}
            </span>
          </div>
        </div>
      )}

      {/* Main Split: Equity Curve + Trade Log */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden min-h-0">
        {/* Equity Curve SVG Chart */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-amber)] tracking-wider">
              Cumulative Equity Curve ($)
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              Final: ${result?.finalCapital.toLocaleString() ?? initialCapital.toLocaleString()}
            </span>
          </div>

          <div className="flex-1 w-full h-full relative flex items-center justify-center min-h-[140px]">
            {result && result.equityCurve.length > 1 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 160" preserveAspectRatio="none">
                {/* Horizontal Zero/Initial reference line */}
                <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                {(() => {
                  const pts = result.equityCurve;
                  const equities = pts.map((p) => p.equity);
                  const min = Math.min(...equities, initialCapital * 0.9);
                  const max = Math.max(...equities, initialCapital * 1.1);
                  const range = max - min || 1;

                  const points = pts
                    .map((p, idx) => {
                      const x = (idx / (pts.length - 1)) * 400;
                      const y = 160 - ((p.equity - min) / range) * 140 - 10;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');

                  const lastY = 160 - ((pts[pts.length - 1].equity - min) / range) * 140 - 10;
                  const isPositive = result.totalReturn >= 0;

                  return (
                    <>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={isPositive ? '#00E676' : '#FF5252'} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`0,160 ${points} 400,160`}
                        fill="url(#eqGrad)"
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke={isPositive ? '#00E676' : '#FF5252'}
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <circle cx="400" cy={lastY} r="3" fill={isPositive ? '#00E676' : '#FF5252'} />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="text-[var(--text-muted)]">No backtest curve generated</div>
            )}
          </div>
        </div>

        {/* Trade Journal Table */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-cyan)] tracking-wider">
              Simulated Execution Log ({result?.trades.length || 0} Trades)
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">Spread adjusted: $0.35/oz</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
            {result && result.trades.length > 0 ? (
              result.trades.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-1.5 rounded bg-[var(--surface-color)]/70 border border-[var(--border-color)] hover:border-[var(--accent-cyan)]/40 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        t.side === 'buy' ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                      }`}
                    >
                      {t.side.toUpperCase()}
                    </span>
                    <span className="text-[var(--text-color)]">
                      ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)]">({t.reason.toUpperCase()})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${t.pnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </span>
                    <span className={`text-[10px] ${t.pnlPercent >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                      ({t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent}%)
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                {isLoading ? 'Computing backtest against Pyth benchmark candles...' : 'No trades triggered for selected criteria'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
