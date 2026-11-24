import React from 'react';
import { HEATMAP_SECTORS, fetchQuotesForSymbols } from '../../services/marketData';
import type { TickerQuote } from '../../types/terminal';
import { useTerminal } from '../../context/TerminalContext';
import { LayoutGrid } from 'lucide-react';

const PROFIT_RGB = '0, 230, 118';
const LOSS_RGB = '255, 59, 48';
const NEUTRAL_RGB = '148, 163, 184';

// Map |change|% to a vivid diverging background alpha (0.25 -> 0.85).
const intensityAlpha = (change: number) =>
  Math.min(0.85, 0.25 + Math.abs(change) / 4);

export const HeatmapWidget: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();

  const [liveQuotes, setLiveQuotes] = React.useState<Record<string, TickerQuote>>({});
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let active = true;
    const symbols = HEATMAP_SECTORS.flatMap((s) => s.items.map((i) => i.symbol));
    const load = () => {
      fetchQuotesForSymbols(symbols).then((q) => {
        if (active) {
          setLiveQuotes(q);
          setLastUpdated(new Date());
        }
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

  const timestamp = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

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
          <LayoutGrid size={13} style={{ color: 'var(--ot-amber)' }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            SECTOR HEATMAP
          </span>
          <span className="text-[10px]" style={{ color: 'var(--ot-text-muted)' }}>
            ·
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--ot-text-secondary)' }}>
            S&amp;P 500 &amp; CRYPTO WEIGHTED
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'var(--ot-text-muted)' }}>
          As of {timestamp}
        </span>
      </div>

      {/* Heatmap Grid */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-3">
        {sectors.map((sector) => {
          const isSectorPos = sector.change >= 0;
          const isSectorFlat = Math.abs(sector.change) < 0.15;
          const sectorColor = isSectorFlat
            ? 'var(--ot-text-secondary)'
            : isSectorPos
            ? 'var(--ot-profit)'
            : 'var(--ot-loss)';
          return (
            <div key={sector.name} className="space-y-1">
              {/* Sector sub-header */}
              <div
                className="flex justify-between items-center pb-1 mb-0.5 border-b"
                style={{ borderColor: 'var(--ot-border)' }}
              >
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--ot-text-primary)' }}
                >
                  {sector.name}
                </span>
                <span
                  className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: sectorColor,
                    backgroundColor: isSectorFlat
                      ? 'rgba(148, 163, 184, 0.12)'
                      : `rgba(${isSectorPos ? PROFIT_RGB : LOSS_RGB}, 0.14)`,
                  }}
                >
                  {isSectorPos ? '+' : ''}
                  {sector.change.toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5 auto-rows-fr">
                {sector.items.map((item) => {
                  const isFlat = Math.abs(item.change) < 0.15;
                  const isPos = item.change >= 0;
                  const isActive = item.symbol === activeSymbol;
                  const alpha = isFlat ? 0.12 : intensityAlpha(item.change);
                  const bg = isFlat
                    ? `rgba(${NEUTRAL_RGB}, ${alpha})`
                    : `rgba(${isPos ? PROFIT_RGB : LOSS_RGB}, ${alpha})`;
                  const changeColor = isFlat
                    ? 'var(--ot-text-secondary)'
                    : isPos
                    ? 'var(--ot-profit)'
                    : 'var(--ot-loss)';

                  return (
                    <button
                      key={item.symbol}
                      onClick={() => setActiveSymbol(item.symbol)}
                      title={`${item.symbol}  ${isPos ? '+' : ''}${item.change.toFixed(
                        2
                      )}%  -  $${item.price.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}  -  weight ${item.weight}`}
                      style={{
                        gridColumn:
                          item.weight > 40
                            ? 'span 6'
                            : item.weight > 30
                            ? 'span 5'
                            : item.weight > 22
                            ? 'span 4'
                            : 'span 3',
                        backgroundColor: bg,
                        borderColor: isActive ? 'var(--ot-amber)' : 'var(--ot-border)',
                        boxShadow: isActive
                          ? '0 0 0 1px var(--ot-amber), 0 0 8px rgba(245, 185, 66, 0.4)'
                          : undefined,
                      }}
                      className="group flex flex-col items-center justify-center p-1 rounded border text-center transition-all duration-150 hover:scale-[1.04] hover:z-10 hover:ring-1 cursor-pointer"
                    >
                      <span
                        className="text-xs font-bold font-mono leading-tight"
                        style={{
                          color: 'var(--ot-text-primary)',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.65)',
                        }}
                      >
                        {item.symbol}
                      </span>
                      <span
                        className="text-[10px] font-mono font-semibold leading-tight"
                        style={{
                          color: changeColor,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.65)',
                        }}
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

      {/* Footer / legend */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-t text-[10px] font-mono"
        style={{ borderColor: 'var(--ot-border)', color: 'var(--ot-text-muted)' }}
      >
        <span>Polygon.io · live · 15s</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: `rgba(${LOSS_RGB}, 0.7)` }}
            />
            Down
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: `rgba(${NEUTRAL_RGB}, 0.25)` }}
            />
            Flat
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: `rgba(${PROFIT_RGB}, 0.7)` }}
            />
            Up
          </span>
        </span>
      </div>
    </div>
  );
};