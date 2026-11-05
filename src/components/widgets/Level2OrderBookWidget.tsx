import React, { useState, useEffect } from 'react';
import { orderBookEngine } from '../../services/orderBookEngine';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { Level2OrderBook, TapeTrade } from '../../types/terminal';
import {
  Layers,
  Activity,
  Flame,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const Level2OrderBookWidget: React.FC = () => {
  const [book, setBook] = useState<Level2OrderBook>(() => orderBookEngine.getBook());
  const [tape, setTape] = useState<TapeTrade[]>(() => orderBookEngine.getTape());
  const [activeTab, setActiveTab] = useState<'book' | 'chart' | 'tape'>('book');

  useEffect(() => {
    const unsubBook = orderBookEngine.subscribeDepth((b) => setBook(b));
    const unsubTape = orderBookEngine.subscribeTape((t) => setTape(t));
    return () => {
      unsubBook();
      unsubTape();
    };
  }, []);

  const handleLevelClick = (price: number, side: 'buy' | 'sell') => {
    paperTradingEngine.placeLimitOrder('XAU/USD', side, 0.5, price);
  };

  const isBuyImbalance = book.imbalancePercent >= 0;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-2.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-amber)]">
            Level 2 Liquidity & Tape
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--accent-cyan)] font-bold">
            PAXG/USDT (Gold 100ms)
          </span>
        </div>

        {/* Tab View Selectors */}
        <div className="flex items-center gap-1 bg-[var(--surface-color)] p-0.5 rounded border border-[var(--border-color)] text-[10px]">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'book' ? 'bg-[var(--accent-amber)] text-black font-bold' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            ORDER BOOK
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'chart' ? 'bg-[var(--accent-cyan)] text-black font-bold' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            DEPTH CHART
          </button>
          <button
            onClick={() => setActiveTab('tape')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'tape' ? 'bg-[var(--accent-emerald)] text-black font-bold' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            T&S TAPE ({tape.length})
          </button>
        </div>
      </div>

      {/* Spread & Imbalance Telemetry Bar */}
      <div className="px-3 py-1.5 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">SPREAD:</span>
          <strong className="text-[var(--accent-cyan)]">${book.spread.toFixed(2)}</strong>
          <span className="text-[10px] text-[var(--text-muted)]">({book.spreadBps} bps)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">BOOK IMBALANCE:</span>
          <span
            className={`font-bold flex items-center gap-0.5 ${
              isBuyImbalance ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'
            }`}
          >
            {isBuyImbalance ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {isBuyImbalance ? '+' : ''}{book.imbalancePercent}% {isBuyImbalance ? 'BUY' : 'SELL'} WALL
          </span>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col p-2">
        {/* VIEW 1: DUAL-COLUMN AGGREGATED 20-LEVEL ORDER BOOK */}
        {activeTab === 'book' && (
          <div className="flex-1 grid grid-cols-2 gap-2 overflow-hidden min-h-0">
            {/* Bids Column (Buyers) */}
            <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded overflow-hidden">
              <div className="px-2 py-1 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[9px] uppercase font-bold text-[var(--text-muted)]">
                <span>Bid Price</span>
                <span>Size (oz)</span>
                <span>Total</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 p-1 font-mono text-[11px]">
                {book.bids.slice(0, 16).map((bid, i) => (
                  <div
                    key={`bid-${i}`}
                    onClick={() => handleLevelClick(bid.price, 'buy')}
                    className="relative flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer hover:bg-[var(--accent-emerald)]/10 transition-colors"
                  >
                    {/* Depth Bar Background */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[var(--accent-emerald)]/15 pointer-events-none rounded-r"
                      style={{ width: `${bid.depthPercent}%` }}
                    />
                    <span className="font-bold text-[var(--accent-emerald)] relative z-10">${bid.price.toFixed(2)}</span>
                    <span className="text-[var(--text-color)] relative z-10">{bid.amount.toFixed(3)}</span>
                    <span className="text-[var(--text-muted)] text-[10px] relative z-10">{bid.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Asks Column (Sellers) */}
            <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded overflow-hidden">
              <div className="px-2 py-1 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[9px] uppercase font-bold text-[var(--text-muted)]">
                <span>Ask Price</span>
                <span>Size (oz)</span>
                <span>Total</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 p-1 font-mono text-[11px]">
                {book.asks.slice(0, 16).map((ask, i) => (
                  <div
                    key={`ask-${i}`}
                    onClick={() => handleLevelClick(ask.price, 'sell')}
                    className="relative flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer hover:bg-[#FF5252]/10 transition-colors"
                  >
                    {/* Depth Bar Background */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[#FF5252]/15 pointer-events-none rounded-l"
                      style={{ width: `${ask.depthPercent}%` }}
                    />
                    <span className="font-bold text-[#FF5252] relative z-10">${ask.price.toFixed(2)}</span>
                    <span className="text-[var(--text-color)] relative z-10">{ask.amount.toFixed(3)}</span>
                    <span className="text-[var(--text-muted)] text-[10px] relative z-10">{ask.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: VISUAL CUMULATIVE DEPTH CHART */}
        {activeTab === 'chart' && (
          <div className="flex-1 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2 overflow-hidden">
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
              <span className="uppercase font-bold text-[var(--accent-cyan)]">Visual Liquidity Walls</span>
              <span>Mid: ${book.midPrice.toFixed(2)}</span>
            </div>

            <div className="flex-1 w-full h-full relative flex items-center justify-center min-h-[160px]">
              {book.bids.length > 2 && book.asks.length > 2 ? (
                <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                  {/* Stepped Cumulative Bids Curve (Left green) */}
                  {(() => {
                    const sortedBids = [...book.bids].reverse();
                    const maxDepth = Math.max(
                      book.bids[book.bids.length - 1]?.total || 1,
                      book.asks[book.asks.length - 1]?.total || 1
                    );

                    let bidPts = '0,200 ';
                    sortedBids.forEach((b, idx) => {
                      const x = (idx / (sortedBids.length - 1)) * 240;
                      const y = 200 - (b.total / maxDepth) * 170;
                      bidPts += `${x.toFixed(1)},${y.toFixed(1)} `;
                    });
                    bidPts += '240,200';

                    // Stepped Cumulative Asks Curve (Right red)
                    let askPts = '260,200 ';
                    book.asks.forEach((a, idx) => {
                      const x = 260 + (idx / (book.asks.length - 1)) * 240;
                      const y = 200 - (a.total / maxDepth) * 170;
                      askPts += `${x.toFixed(1)},${y.toFixed(1)} `;
                    });
                    askPts += '500,200';

                    return (
                      <>
                        <polygon points={bidPts} fill="rgba(0, 230, 118, 0.25)" stroke="#00E676" strokeWidth="1.5" />
                        <polygon points={askPts} fill="rgba(255, 82, 82, 0.25)" stroke="#FF5252" strokeWidth="1.5" />
                        {/* Mid-price vertical divide */}
                        <line x1="250" y1="10" x2="250" y2="200" stroke="var(--accent-amber)" strokeWidth="1.5" strokeDasharray="3 3" />
                        <text x="250" y="20" fill="var(--accent-amber)" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                          MID ${book.midPrice.toFixed(2)}
                        </text>
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="text-[var(--text-muted)]">Streaming live order book depth...</div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: TIME & SALES HIGH-FREQUENCY TAPE */}
        {activeTab === 'tape' && (
          <div className="flex-1 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded overflow-hidden">
            <div className="px-3 py-1 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[9px] uppercase font-bold text-[var(--text-muted)]">
              <span>Time (UTC)</span>
              <span>Executed Price</span>
              <span>Size (oz)</span>
              <span>Aggressor Side</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5 p-1 font-mono text-[11px]">
              {tape.map((tr) => {
                const date = new Date(tr.timestamp);
                const timeStr = date.toTimeString().slice(0, 8) + '.' + date.getMilliseconds().toString().padStart(3, '0');
                const isBuy = tr.side === 'buy';

                return (
                  <div
                    key={tr.id}
                    className={`flex items-center justify-between px-2 py-0.5 rounded transition-colors ${
                      tr.isSweep
                        ? 'bg-[var(--accent-amber)]/20 border border-[var(--accent-amber)]/40 font-bold'
                        : 'hover:bg-[var(--surface-color)]'
                    }`}
                  >
                    <span className="text-[10px] text-[var(--text-muted)]">{timeStr}</span>
                    <span className={`font-bold ${isBuy ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                      ${tr.price.toFixed(2)}
                    </span>
                    <span className="text-[var(--text-color)]">{tr.amount.toFixed(3)} oz</span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isBuy ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                        }`}
                      >
                        {tr.side.toUpperCase()}
                      </span>
                      {tr.isSweep && (
                        <span className="flex items-center gap-0.5 text-[8px] bg-[var(--accent-amber)] text-black px-1 rounded font-bold">
                          <Flame className="w-2.5 h-2.5 fill-current" />
                          <span>SWEEP</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
