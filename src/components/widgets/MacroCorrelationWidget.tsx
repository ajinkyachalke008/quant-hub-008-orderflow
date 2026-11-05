import React, { useState, useEffect } from 'react';
import { macroStreamService, MacroState } from '../../services/macroStreamService';
import { Globe, TrendingUp, TrendingDown, Layers, Activity } from 'lucide-react';

export const MacroCorrelationWidget: React.FC = () => {
  const [macroState, setMacroState] = useState<MacroState>(macroStreamService.getState());

  useEffect(() => {
    const unsub = macroStreamService.subscribe((s) => {
      setMacroState({ ...s });
    });
    return unsub;
  }, []);

  const quotes = Object.values(macroState.quotes);
  const gsr = macroState.goldSilverRatio;

  // Correlation heat styling helper
  const getCorrelationColor = (r: number) => {
    if (r >= 0.6) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50';
    if (r >= 0.2) return 'text-teal-300 bg-teal-950/30 border-teal-800/40';
    if (r <= -0.6) return 'text-rose-400 bg-rose-950/40 border-rose-800/50';
    if (r <= -0.2) return 'text-amber-400 bg-amber-950/30 border-amber-800/40';
    return 'text-slate-400 bg-slate-900/40 border-slate-800/40';
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md flex flex-col h-full overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--accent)]">MACRO WATCHLIST & 1H CORRELATION MATRIX</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>HERMES SSE + BINANCE FEED</span>
        </div>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        {/* Top Highlight: Real-Time Gold-to-Silver Ratio (GSR) */}
        <div className="p-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] block">GOLD-TO-SILVER RATIO (GSR)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold text-[var(--accent)]">
                {gsr > 0 ? gsr.toFixed(2) : '--.--'}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">XAU / XAG</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[var(--text-muted)] block">HISTORICAL RANGE</span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              {gsr > 85 ? 'Silver Undervalued (High Ratio)' : gsr < 65 ? 'Gold Undervalued' : 'Historical Mean (70-85)'}
            </span>
          </div>
        </div>

        {/* Multi-Asset Macro Watchlist Table */}
        <div className="border border-[var(--border)] rounded overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-elevated)] text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="p-2 font-medium">ASSET</th>
                <th className="p-2 font-medium text-right">SPOT PRICE</th>
                <th className="p-2 font-medium text-right">24H DELTA</th>
                <th className="p-2 font-medium text-right">GOLD CORR (1H $\rho$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {quotes.map((q) => {
                const corr = q.correlationWithGold ?? 0;
                const isGold = q.symbol === 'XAU/USD';
                return (
                  <tr key={q.symbol} className="hover:bg-[var(--surface-elevated)]/60 transition-colors">
                    <td className="p-2">
                      <div className="font-semibold text-[var(--text-primary)]">{q.symbol}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{q.name}</div>
                    </td>
                    <td className="p-2 text-right font-bold tabular-nums text-[var(--text-primary)]">
                      {q.price > 0
                        ? `$${q.price >= 100 ? q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : q.price.toFixed(4)}`
                        : 'Streaming...'}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          q.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {q.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {q.change24h >= 0 ? '+' : ''}
                        {q.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {isGold ? (
                        <span className="text-[10px] text-[var(--accent)] font-semibold">1.00 (Anchor)</span>
                      ) : (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getCorrelationColor(
                            corr
                          )}`}
                        >
                          {corr >= 0 ? `+${corr.toFixed(2)}` : corr.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Institutional Divergence Analysis Note */}
        <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[10px] text-[var(--text-muted)] flex items-start gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            <strong>Institutional Macro Note:</strong> Negative correlation with USD/JPY indicates strong DXY inverse
            coordination; positive Silver (XAG) synchronization confirms physical bullion demand rather than isolated currency hedging.
          </span>
        </div>
      </div>
    </div>
  );
};
