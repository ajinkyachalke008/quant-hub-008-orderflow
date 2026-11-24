import React, { useState, useEffect } from 'react';
import { SCREENER_ITEMS, fetchQuotesForSymbols } from '../../services/marketData';
import type { TickerQuote } from '../../types/terminal';
import { useTerminal } from '../../context/TerminalContext';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

const GRID_COLS =
  'grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)] items-center';

function sparkPoints(data: number[], w = 60, h = 20, pad = 2): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const n = data.length;
  return data
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatVolume(raw: string): string {
  if (!raw || raw === 'N/A') return '\u2014';
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!isFinite(n) || n <= 0) return '\u2014';
  const u = raw.toUpperCase();
  let abs = n;
  if (u.includes('T')) abs = n * 1e12;
  else if (u.includes('B')) abs = n * 1e9;
  else if (u.includes('M')) abs = n * 1e6;
  else if (u.includes('K')) abs = n * 1e3;
  if (abs >= 1e12) return `${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(1)}K`;
  return abs.toFixed(0);
}

export const ScreenerWidget: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'marketCap' | 'change' | 'peRatio'>('marketCap');
  const [sortAsc, setSortAsc] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const sectors = ['all', 'Semiconductors', 'Software - Infrastructure', 'Internet Content', 'Auto Manufacturers'];

  const [liveQuotes, setLiveQuotes] = useState<Record<string, TickerQuote>>({});

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchQuotesForSymbols(SCREENER_ITEMS.map((i) => i.symbol)).then((q) => {
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

  const merged = SCREENER_ITEMS.map((item) => {
    const q = liveQuotes[item.symbol];
    return {
      ...item,
      price: q ? q.price : item.price,
      change: q ? q.changePercent : item.change,
      marketCap: q ? q.marketCap : item.marketCap,
      volume: q ? q.volume : item.volume,
      sparkline: q && q.sparkline ? q.sparkline : [],
    };
  });

  const filtered = merged.filter((item) => {
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

  const renderSortIcon = (col: typeof sortBy) => {
    if (sortBy !== col) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />;
    }
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 shrink-0" />
    ) : (
      <ChevronDown className="w-3 h-3 shrink-0" />
    );
  };

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
          <span className="text-[10px]" style={{ color: 'var(--ot-text-muted)' }}>&middot;</span>
          <span className="text-xs font-mono" style={{ color: 'var(--ot-text-secondary)' }}>
            ({filtered.length} RESULTS)
          </span>
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
        className={`${GRID_COLS} sticky top-0 z-10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border-b`}
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
          color: 'var(--ot-text-muted)',
        }}
      >
        <div className="text-left">TICKER / SECTOR</div>
        <div className="text-right">PRICE</div>
        <button
          onClick={() => {
            setSortBy('change');
            setSortAsc(!sortAsc);
          }}
          className={`flex items-center justify-end gap-1 uppercase tracking-wide transition-colors ${
            sortBy === 'change' ? '' : 'hover:text-[var(--ot-text-primary)]'
          }`}
          style={{ color: sortBy === 'change' ? 'var(--ot-cyan)' : undefined }}
        >
          <span>24H %</span>
          {renderSortIcon('change')}
        </button>
        <div className="text-right">TREND</div>
        <button
          onClick={() => {
            setSortBy('marketCap');
            setSortAsc(!sortAsc);
          }}
          className={`flex items-center justify-end gap-1 uppercase tracking-wide transition-colors ${
            sortBy === 'marketCap' ? '' : 'hover:text-[var(--ot-text-primary)]'
          }`}
          style={{ color: sortBy === 'marketCap' ? 'var(--ot-cyan)' : undefined }}
        >
          <span>MKT CAP</span>
          {renderSortIcon('marketCap')}
        </button>
        <div className="text-right">VOLUME</div>
        <button
          onClick={() => {
            setSortBy('peRatio');
            setSortAsc(!sortAsc);
          }}
          className={`flex items-center justify-end gap-1 uppercase tracking-wide transition-colors ${
            sortBy === 'peRatio' ? '' : 'hover:text-[var(--ot-text-primary)]'
          }`}
          style={{ color: sortBy === 'peRatio' ? 'var(--ot-cyan)' : undefined }}
        >
          <span>P/E</span>
          {renderSortIcon('peRatio')}
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
              className={`${GRID_COLS} group px-3 py-2 text-xs font-mono tabular-nums cursor-pointer transition-colors border-l-2 ${
                isActive
                  ? ''
                  : 'border-l-transparent odd:bg-white/[0.015] hover:bg-[var(--ot-bg-hover)]! hover:border-l-[color:var(--ot-cyan)]'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--ot-bg-hover)' : undefined,
                borderLeftColor: isActive ? 'var(--ot-cyan)' : undefined,
              }}
            >
              <div className="flex flex-col truncate min-w-0">
                <span
                  className="font-bold truncate"
                  style={{ color: isActive ? 'var(--ot-amber)' : 'var(--ot-text-primary)' }}
                >
                  {item.symbol}
                </span>
                <span className="text-[10px] truncate" style={{ color: 'var(--ot-text-muted)' }}>
                  {item.sector}
                </span>
              </div>

              <div className="text-right font-semibold" style={{ color: 'var(--ot-text-primary)' }}>
                ${item.price.toFixed(2)}
              </div>

              <div
                className="flex items-center justify-end gap-0.5 font-medium"
                style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
              >
                {isPos ? (
                  <ChevronUp className="w-3 h-3 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 shrink-0" />
                )}
                <span>
                  {isPos ? '+' : ''}
                  {item.change.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center justify-end min-w-0">
                {item.sparkline.length >= 2 ? (
                  <svg
                    viewBox="0 0 60 20"
                    preserveAspectRatio="none"
                    width="100%"
                    height="16"
                    className="block max-w-[64px]"
                  >
                    <polyline
                      fill="none"
                      stroke={isPos ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={sparkPoints(item.sparkline)}
                    />
                  </svg>
                ) : (
                  <span style={{ color: 'var(--ot-text-muted)' }}>&mdash;</span>
                )}
              </div>

              <div className="text-right" style={{ color: 'var(--ot-text-secondary)' }}>
                {item.marketCap}
              </div>

              <div className="text-right" style={{ color: 'var(--ot-text-secondary)' }}>
                {formatVolume(item.volume)}
              </div>

              <div className="text-right" style={{ color: 'var(--ot-text-muted)' }}>
                {item.peRatio.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide border-t"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
          color: 'var(--ot-text-muted)',
        }}
      >
        <span>{filtered.length} SYMBOLS</span>
        <span>
          UPDATED {lastUpdated ? lastUpdated.toLocaleTimeString('en-GB') : '\u2014'}
        </span>
      </div>
    </div>
  );
};