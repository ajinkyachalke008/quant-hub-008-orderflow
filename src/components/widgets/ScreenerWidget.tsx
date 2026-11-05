import React, { useState } from 'react';
import { SCREENER_ITEMS } from '../../services/marketData';
import { useTerminal } from '../../context/TerminalContext';
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export const ScreenerWidget: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'marketCap' | 'change' | 'peRatio'>('marketCap');
  const [sortAsc, setSortAsc] = useState(false);

  const sectors = ['all', 'Semiconductors', 'Software - Infrastructure', 'Internet Content', 'Auto Manufacturers'];

  const filtered = SCREENER_ITEMS.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = selectedSector === 'all' || item.sector === selectedSector;
    return matchesSearch && matchesSector;
  }).sort((a, b) => {
    let diff = 0;
    if (sortBy === 'marketCap') diff = a.marketCapNum - b.marketCapNum;
    if (sortBy === 'change') diff = a.change - b.change;
    if (sortBy === 'peRatio') diff = a.peRatio - b.peRatio;
    return sortAsc ? diff : -diff;
  });

  return (
    <div
      className="flex flex-col h-full rounded border select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Header & Search */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            EQUITY SCREENER
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">({filtered.length} RESULTS)</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-24 px-2 py-0.5 text-xs font-mono rounded border uppercase outline-none"
            style={{
              backgroundColor: 'var(--ot-bg-root)',
              borderColor: 'var(--ot-border)',
              color: 'var(--ot-text-primary)',
            }}
          />

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-2 py-0.5 text-xs font-mono rounded border outline-none"
            style={{
              backgroundColor: 'var(--ot-bg-root)',
              borderColor: 'var(--ot-border)',
              color: 'var(--ot-text-secondary)',
            }}
          >
            <option value="all">ALL SECTORS</option>
            <option value="Semiconductors">SEMICONDUCTORS</option>
            <option value="Software - Infrastructure">SOFTWARE</option>
            <option value="Internet Content">INTERNET</option>
            <option value="Auto Manufacturers">AUTO</option>
          </select>
        </div>
      </div>

      {/* Table Columns */}
      <div
        className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-mono border-b text-slate-400"
        style={{ borderColor: 'var(--ot-border)' }}
      >
        <div className="col-span-3 text-left">TICKER / SECTOR</div>
        <div className="col-span-2 text-right">PRICE</div>
        <button
          onClick={() => {
            setSortBy('change');
            setSortAsc(!sortAsc);
          }}
          className="col-span-2 text-right hover:text-slate-200"
        >
          24H %
        </button>
        <button
          onClick={() => {
            setSortBy('marketCap');
            setSortAsc(!sortAsc);
          }}
          className="col-span-3 text-right hover:text-slate-200"
        >
          MKT CAP
        </button>
        <button
          onClick={() => {
            setSortBy('peRatio');
            setSortAsc(!sortAsc);
          }}
          className="col-span-2 text-right hover:text-slate-200"
        >
          P/E
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--ot-border)' }}>
        {filtered.map((item) => {
          const isActive = item.symbol === activeSymbol;
          const isPos = item.change >= 0;

          return (
            <div
              key={item.symbol}
              onClick={() => setActiveSymbol(item.symbol)}
              className={`grid grid-cols-12 items-center px-3 py-2 text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                isActive ? 'border-l-2' : 'hover:bg-slate-800/25'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--ot-bg-hover)' : 'transparent',
                borderColor: isActive ? 'var(--ot-cyan)' : 'var(--ot-border)',
              }}
            >
              <div className="col-span-3 flex flex-col truncate">
                <span className="font-bold" style={{ color: isActive ? 'var(--ot-amber)' : 'var(--ot-text-primary)' }}>
                  {item.symbol}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{item.sector}</span>
              </div>

              <div className="col-span-2 text-right font-semibold text-slate-100">
                ${item.price.toFixed(2)}
              </div>

              <div
                className="col-span-2 text-right font-medium"
                style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
              >
                {isPos ? '+' : ''}
                {item.change.toFixed(2)}%
              </div>

              <div className="col-span-3 text-right text-slate-300">{item.marketCap}</div>

              <div className="col-span-2 text-right text-slate-400">{item.peRatio.toFixed(1)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
