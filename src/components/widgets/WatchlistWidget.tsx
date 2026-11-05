import React, { useState } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { Plus, X, ArrowUpDown, TrendingUp } from 'lucide-react';

export const WatchlistWidget: React.FC = () => {
  const {
    watchlist,
    quotes,
    activeSymbol,
    setActiveSymbol,
    addToWatchlist,
    removeFromWatchlist,
  } = useTerminal();

  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [sortField, setSortField] = useState<'symbol' | 'price' | 'change'>('change');
  const [sortAsc, setSortAsc] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbolInput.trim()) {
      addToWatchlist(newSymbolInput.trim().toUpperCase());
      setNewSymbolInput('');
    }
  };

  const sortedList = [...watchlist].sort((a, b) => {
    const quoteA = quotes[a];
    const quoteB = quotes[b];
    if (!quoteA || !quoteB) return 0;

    let res = 0;
    if (sortField === 'symbol') res = a.localeCompare(b);
    if (sortField === 'price') res = quoteA.price - quoteB.price;
    if (sortField === 'change') res = quoteA.changePercent - quoteB.changePercent;

    return sortAsc ? res : -res;
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
            WATCHLIST
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">({watchlist.length})</span>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAdd} className="flex items-center gap-1">
          <input
            type="text"
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
            placeholder="+ TICKER"
            className="w-20 px-1.5 py-0.5 text-xs font-mono rounded border uppercase outline-none focus:border-amber-400"
            style={{
              backgroundColor: 'var(--ot-bg-root)',
              borderColor: 'var(--ot-border)',
              color: 'var(--ot-text-primary)',
            }}
          />
          <button
            type="submit"
            className="p-1 rounded border hover:brightness-110"
            style={{ borderColor: 'var(--ot-border)', color: 'var(--ot-cyan)' }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </form>
      </div>

      {/* Sortable Header Bar */}
      <div
        className="grid grid-cols-12 px-3 py-1 text-[10px] font-mono border-b text-slate-400"
        style={{ borderColor: 'var(--ot-border)' }}
      >
        <button
          onClick={() => {
            setSortField('symbol');
            setSortAsc(!sortAsc);
          }}
          className="col-span-4 text-left flex items-center gap-1 hover:text-slate-200"
        >
          <span>TICKER</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => {
            setSortField('price');
            setSortAsc(!sortAsc);
          }}
          className="col-span-3 text-right flex items-center justify-end gap-1 hover:text-slate-200"
        >
          <span>LAST</span>
        </button>
        <button
          onClick={() => {
            setSortField('change');
            setSortAsc(!sortAsc);
          }}
          className="col-span-3 text-right flex items-center justify-end gap-1 hover:text-slate-200"
        >
          <span>24H %</span>
        </button>
        <div className="col-span-2 text-right">TREND</div>
      </div>

      {/* Watchlist Rows */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--ot-border)' }}>
        {sortedList.map((sym) => {
          const q = quotes[sym];
          if (!q) return null;
          const isActive = sym === activeSymbol;
          const isPos = q.change >= 0;

          // Mini sparkline SVG points
          const minSpark = Math.min(...q.sparkline);
          const maxSpark = Math.max(...q.sparkline);
          const range = maxSpark - minSpark || 1;
          const points = q.sparkline
            .map((val, idx) => {
              const x = (idx / (q.sparkline.length - 1)) * 40;
              const y = 14 - ((val - minSpark) / range) * 12;
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <div
              key={sym}
              onClick={() => setActiveSymbol(sym)}
              className={`grid grid-cols-12 items-center px-3 py-2 text-xs font-mono tabular-nums cursor-pointer transition-colors group ${
                isActive ? 'font-semibold border-l-2' : 'hover:bg-slate-800/40'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--ot-bg-hover)' : 'transparent',
                borderColor: isActive ? 'var(--ot-cyan)' : 'var(--ot-border)',
              }}
            >
              {/* Ticker & Name */}
              <div className="col-span-4 flex flex-col truncate">
                <span style={{ color: isActive ? 'var(--ot-amber)' : 'var(--ot-text-primary)' }}>
                  {sym}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{q.name}</span>
              </div>

              {/* Price */}
              <div className="col-span-3 text-right font-semibold" style={{ color: 'var(--ot-text-primary)' }}>
                ${q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {/* Change % */}
              <div
                className="col-span-3 text-right font-medium"
                style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
              >
                {isPos ? '+' : ''}
                {q.changePercent.toFixed(2)}%
              </div>

              {/* Mini Sparkline + Delete Button */}
              <div className="col-span-2 flex items-center justify-end gap-1">
                <svg width="40" height="16" className="overflow-visible hidden sm:block">
                  <polyline
                    fill="none"
                    stroke={isPos ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                    strokeWidth="1.2"
                    points={points}
                  />
                </svg>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(sym);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-opacity"
                  title="Remove from watchlist"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
