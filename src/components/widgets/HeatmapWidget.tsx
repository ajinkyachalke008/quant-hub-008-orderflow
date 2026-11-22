import React from 'react';
import { HEATMAP_SECTORS, fetchQuotesForSymbols } from '../../services/marketData';
import type { TickerQuote } from '../../types/terminal';
import { useTerminal } from '../../context/TerminalContext';
import { LayoutGrid } from 'lucide-react';

export const HeatmapWidget: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();

  const [liveQuotes, setLiveQuotes] = React.useState<Record<string, TickerQuote>>({});

  React.useEffect(() => {
    let active = true;
    const symbols = HEATMAP_SECTORS.flatMap((s) => s.items.map((i) => i.symbol));
    const load = () => {
      fetchQuotesForSymbols(symbols).then((q) => {
        if (active) setLiveQuotes(q);
      });
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const sectors = HEATMAP_SECTORS.map((sector) => {
    const items = sector.items.map((item) => {
      const q = liveQuotes[item.symbol];
      return q
        ? { ...item, change: q.changePercent, price: q.price, marketCap: q.marketCap }
        : item;
    });
    const avgChange =
      items.length > 0 ? items.reduce((acc, it) => acc + it.change, 0) / items.length : 0;
    return { ...sector, change: avgChange, items };
  });

  return (
    <div
      className="flex flex-col h-full rounded border select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            SECTOR HEATMAP
          </span>
          <span className="text-[10px] text-slate-400">Â·</span>
          <span className="text-xs font-mono text-slate-400">S&P 500 & CRYPTO WEIGHTED</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">PERFORMANCE MAP</span>
      </div>

      {/* Heatmap Grid */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-3">
        {sectors.map((sector) => {
          const isSectorPos = sector.change >= 0;
          return (
            <div key={sector.name} className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="font-semibold text-slate-300">{sector.name}</span>
                <span
                  style={{
                    color: isSectorPos ? 'var(--ot-profit)' : 'var(--ot-loss)',
                  }}
                >
                  {isSectorPos ? '+' : ''}
                  {sector.change.toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5 h-16">
                {sector.items.map((item) => {
                  const isPos = item.change >= 0;
                  const isActive = item.symbol === activeSymbol;
                  // Calculate intensity
                  const opacity = Math.min(0.9, Math.max(0.3, Math.abs(item.change) / 3));

                  return (
                    <button
                      key={item.symbol}
                      onClick={() => setActiveSymbol(item.symbol)}
                      style={{
                        gridColumn: item.weight > 30 ? 'span 5' : item.weight > 20 ? 'span 4' : 'span 3',
                        backgroundColor: isPos ? 'rgba(0, 230, 118, 0.18)' : 'rgba(255, 59, 48, 0.18)',
                        borderColor: isActive ? 'var(--ot-amber)' : 'var(--ot-border)',
                      }}
                      className={`flex flex-col items-center justify-center p-1 rounded border text-center transition-all hover:scale-[1.02] cursor-pointer ${
                        isActive ? 'ring-1 ring-amber-400' : ''
                      }`}
                    >
                      <span className="text-xs font-bold font-mono text-slate-100">{item.symbol}</span>
                      <span
                        className="text-[10px] font-mono font-semibold"
                        style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                      >
                        {isPos ? '+' : ''}
                        {item.change.toFixed(2)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
