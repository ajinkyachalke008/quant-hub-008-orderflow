import React, { useState } from 'react';
import { NEWS_FEED } from '../../services/marketData';
import { useTerminal } from '../../context/TerminalContext';
import { Newspaper, ExternalLink, Filter } from 'lucide-react';

export const NewsWidget: React.FC = () => {
  const { setActiveSymbol } = useTerminal();
  const [filter, setFilter] = useState<'all' | 'gold' | 'crypto' | 'macro' | 'tech'>('all');

  const filteredNews = NEWS_FEED.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'gold') return item.symbols.some((s) => ['XAU/USD', 'GOLD', 'XAU'].includes(s));
    if (filter === 'crypto') return item.symbols.some((s) => ['BTC', 'ETH', 'COIN'].includes(s));
    if (filter === 'macro') return item.symbols.some((s) => ['SPY', 'QQQ', 'US10Y'].includes(s));
    if (filter === 'tech') return item.symbols.some((s) => ['NVDA', 'AAPL', 'MSFT', 'TSLA'].includes(s));
    return true;
  });

  return (
    <div
      className="flex flex-col h-full rounded border select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Header & Category Buttons */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            MARKET WIRE
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">LIVE FEED</span>
        </div>

        {/* Filter buttons (Interactive segmented controls per Constitution) */}
        <div
          className="flex items-center p-0.5 rounded border text-[10px] font-mono"
          style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-panel)' }}
        >
          {(['all', 'gold', 'tech', 'macro', 'crypto'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-1.5 py-0.5 rounded uppercase transition-colors ${
                filter === cat ? 'font-bold' : 'opacity-60 hover:opacity-100'
              }`}
              style={
                filter === cat
                  ? { backgroundColor: 'var(--ot-bg-hover)', color: 'var(--ot-cyan)' }
                  : { color: 'var(--ot-text-secondary)' }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* News Feed Stream */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--ot-border)' }}>
        {filteredNews.map((item) => {
          const sentimentColor =
            item.sentiment === 'bullish'
              ? 'var(--ot-profit)'
              : item.sentiment === 'bearish'
              ? 'var(--ot-loss)'
              : 'var(--ot-text-secondary)';

          return (
            <div
              key={item.id}
              className="p-3 space-y-1.5 hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="font-semibold text-slate-300">{item.source}</span>
                <span>{item.timeAgo}</span>
              </div>

              <div
                className="text-xs font-medium leading-snug cursor-pointer hover:underline text-slate-100"
              >
                {item.title}
              </div>

              <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                {item.snippet}
              </p>

              <div className="flex items-center justify-between pt-1">
                {/* Ticker Tags */}
                <div className="flex items-center gap-1.5">
                  {item.symbols.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => setActiveSymbol(sym)}
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded border hover:brightness-125 transition-all"
                      style={{
                        borderColor: 'var(--ot-border)',
                        color: 'var(--ot-amber)',
                        backgroundColor: 'var(--ot-bg-surface)',
                      }}
                    >
                      ${sym}
                    </button>
                  ))}
                </div>

                {/* Sentiment Label (Unboxed text with middot per zero-pill rule) */}
                <span
                  className="text-[10px] font-mono uppercase tracking-wider font-semibold"
                  style={{ color: sentimentColor }}
                >
                  {item.sentiment}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
