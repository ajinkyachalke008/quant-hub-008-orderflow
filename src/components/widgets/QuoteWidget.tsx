import React from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { Bookmark, BookmarkCheck, TrendingUp, DollarSign, Activity } from 'lucide-react';

export const QuoteWidget: React.FC = () => {
  const { activeQuote, watchlist, addToWatchlist, removeFromWatchlist } = useTerminal();

  const isSaved = watchlist.includes(activeQuote.symbol);
  const isPos = activeQuote.change >= 0;

  // 52-week position calculation
  const rangeDiff = activeQuote.fiftyTwoWeekHigh - activeQuote.fiftyTwoWeekLow;
  const rangePct = rangeDiff > 0
    ? Math.min(100, Math.max(0, ((activeQuote.price - activeQuote.fiftyTwoWeekLow) / rangeDiff) * 100))
    : 50;

  return (
    <div
      className="flex flex-col h-full rounded border select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Widget Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            SECURITY QUOTE
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono font-semibold text-slate-200">{activeQuote.symbol}</span>
        </div>

        <button
          onClick={() => (isSaved ? removeFromWatchlist(activeQuote.symbol) : addToWatchlist(activeQuote.symbol))}
          className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border transition-colors hover:brightness-110"
          style={{
            borderColor: 'var(--ot-border)',
            backgroundColor: isSaved ? 'var(--ot-bg-hover)' : 'transparent',
            color: isSaved ? 'var(--ot-amber)' : 'var(--ot-text-secondary)',
          }}
        >
          {isSaved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
          <span>{isSaved ? 'WATCHING' : '+ WATCHLIST'}</span>
        </button>
      </div>

      <div className="p-3.5 space-y-4 overflow-y-auto">
        {/* Main Price Header */}
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: 'var(--ot-text-primary)' }}>
              ${activeQuote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400">{activeQuote.name}</div>
          </div>

          <div className="text-right">
            <div
              className="text-base font-bold font-mono"
              style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
            >
              {isPos ? '+' : ''}
              {activeQuote.change.toFixed(2)} ({isPos ? '+' : ''}
              {activeQuote.changePercent.toFixed(2)}%)
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              REAL-TIME QUOTE
            </div>
          </div>
        </div>

        {/* 52-Week Range Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>52W L: ${activeQuote.fiftyTwoWeekLow.toFixed(2)}</span>
            <span style={{ color: 'var(--ot-cyan)' }}>52-WEEK RANGE</span>
            <span>52W H: ${activeQuote.fiftyTwoWeekHigh.toFixed(2)}</span>
          </div>
          <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${rangePct}%`,
                backgroundColor: 'var(--ot-amber)',
              }}
            />
          </div>
        </div>

        {/* Fundamental Statistics Grid */}
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3 rounded border text-xs font-mono"
          style={{
            borderColor: 'var(--ot-border)',
            backgroundColor: 'var(--ot-bg-surface)',
          }}
        >
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">Open</span>
            <span className="font-semibold text-slate-200">${activeQuote.open.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">Day High</span>
            <span className="font-semibold text-slate-200">${activeQuote.high.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">Day Low</span>
            <span className="font-semibold text-slate-200">${activeQuote.low.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">Volume</span>
            <span className="font-semibold text-slate-200">{activeQuote.volume}</span>
          </div>
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">Market Cap</span>
            <span className="font-semibold text-slate-200">{activeQuote.marketCap}</span>
          </div>
          <div className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--ot-border)' }}>
            <span className="text-slate-400">P/E Ratio</span>
            <span className="font-semibold text-slate-200">{activeQuote.peRatio ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Beta</span>
            <span className="font-semibold text-slate-200">{activeQuote.beta ?? '1.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Div Yield</span>
            <span className="font-semibold text-slate-200">{activeQuote.divYield ?? 'N/A'}</span>
          </div>
        </div>

        {/* Orderbook Depth Simulation / Bid-Ask Ladder */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
            <span>LEVEL II DEPTH</span>
            <span>SPREAD: $0.02</span>
          </div>
          <div
            className="grid grid-cols-2 gap-2 p-2 rounded border text-[11px] font-mono tabular-nums"
            style={{
              borderColor: 'var(--ot-border)',
              backgroundColor: 'var(--ot-bg-surface)',
            }}
          >
            {/* Bids */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 font-semibold border-b pb-0.5" style={{ borderColor: 'var(--ot-border)' }}>
                BID / SIZE
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>${(activeQuote.price - 0.01).toFixed(2)}</span>
                <span className="text-slate-400">1,400</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>${(activeQuote.price - 0.03).toFixed(2)}</span>
                <span className="text-slate-400">2,850</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>${(activeQuote.price - 0.05).toFixed(2)}</span>
                <span className="text-slate-400">5,100</span>
              </div>
            </div>

            {/* Asks */}
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 font-semibold border-b pb-0.5" style={{ borderColor: 'var(--ot-border)' }}>
                ASK / SIZE
              </div>
              <div className="flex justify-between text-rose-400">
                <span>${(activeQuote.price + 0.01).toFixed(2)}</span>
                <span className="text-slate-400">1,200</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>${(activeQuote.price + 0.02).toFixed(2)}</span>
                <span className="text-slate-400">3,400</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>${(activeQuote.price + 0.04).toFixed(2)}</span>
                <span className="text-slate-400">4,900</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
