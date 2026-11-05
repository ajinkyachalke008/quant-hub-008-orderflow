import React, { useEffect, useState } from 'react';
import { xauusdService } from '../../services/xauusdDataService';
import { OrderBookEntry, TradeTick } from '../../types/terminal';
import { Layers, Activity, ArrowDown, ArrowUp } from 'lucide-react';

export const GoldOrderBookWidget: React.FC = () => {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [trades, setTrades] = useState<TradeTick[]>([]);

  useEffect(() => {
    const unsubDepth = xauusdService.subscribeDepth((newBids, newAsks) => {
      setBids(newBids.slice(0, 12));
      setAsks(newAsks.slice(0, 12));
    });

    const unsubTrades = xauusdService.subscribeTrades((newTrade) => {
      setTrades((prev) => [newTrade, ...prev.slice(0, 19)]);
    });

    return () => {
      unsubDepth();
      unsubTrades();
    };
  }, []);

  const bestBid = bids[0]?.price || 4043.47;
  const bestAsk = asks[0]?.price || 4043.48;
  const spread = +(bestAsk - bestBid).toFixed(2);
  const maxBidTotal = bids[bids.length - 1]?.total || 10;
  const maxAskTotal = asks[asks.length - 1]?.total || 10;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal, 1);

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
          <Layers className="w-3.5 h-3.5" style={{ color: 'var(--ot-cyan)' }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            XAU/USD LEVEL II DEPTH
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            BINANCE WS @ 100ms
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300">
          <span className="text-[10px] text-slate-400">20-LEVEL LADDER</span>
          <span>SPREAD: <strong className="text-amber-400">${spread}</strong></span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 divide-x overflow-hidden" style={{ borderColor: 'var(--ot-border)' }}>
        {/* Order Book Column (Bids & Asks) */}
        <div className="col-span-7 flex flex-col min-h-0">
          <div
            className="grid grid-cols-3 px-2 py-1 text-[10px] font-mono border-b text-slate-400 font-semibold"
            style={{ borderColor: 'var(--ot-border)' }}
          >
            <div>PRICE (USD)</div>
            <div className="text-right">SIZE (OZ)</div>
            <div className="text-right">TOTAL</div>
          </div>

          {/* Asks (Sells - In Red) */}
          <div className="flex-1 overflow-y-auto divide-y font-mono text-[11px] tabular-nums" style={{ borderColor: 'var(--ot-border)' }}>
            {asks.slice().reverse().map((ask, idx) => {
              const depthPct = Math.min(100, (ask.total / maxTotal) * 100);
              return (
                <div
                  key={`ask-${idx}`}
                  className="grid grid-cols-3 px-2 py-0.5 relative items-center hover:bg-slate-800/30"
                >
                  <div
                    className="absolute inset-y-0 right-0 opacity-15 pointer-events-none"
                    style={{ width: `${depthPct}%`, backgroundColor: 'var(--ot-loss)' }}
                  />
                  <span style={{ color: 'var(--ot-loss)' }}>${ask.price.toFixed(2)}</span>
                  <span className="text-right text-slate-300">{ask.amount.toFixed(4)}</span>
                  <span className="text-right text-slate-500">{ask.total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          {/* Mid Market Price Line */}
          <div
            className="flex justify-between items-center px-3 py-1 text-xs font-mono font-bold border-y"
            style={{
              borderColor: 'var(--ot-border)',
              backgroundColor: 'var(--ot-bg-surface)',
              color: 'var(--ot-amber)',
            }}
          >
            <span>MID SPREAD</span>
            <span>${((bestBid + bestAsk) / 2).toFixed(2)}</span>
          </div>

          {/* Bids (Buys - In Green) */}
          <div className="flex-1 overflow-y-auto divide-y font-mono text-[11px] tabular-nums" style={{ borderColor: 'var(--ot-border)' }}>
            {bids.map((bid, idx) => {
              const depthPct = Math.min(100, (bid.total / maxTotal) * 100);
              return (
                <div
                  key={`bid-${idx}`}
                  className="grid grid-cols-3 px-2 py-0.5 relative items-center hover:bg-slate-800/30"
                >
                  <div
                    className="absolute inset-y-0 right-0 opacity-15 pointer-events-none"
                    style={{ width: `${depthPct}%`, backgroundColor: 'var(--ot-profit)' }}
                  />
                  <span style={{ color: 'var(--ot-profit)' }}>${bid.price.toFixed(2)}</span>
                  <span className="text-right text-slate-300">{bid.amount.toFixed(4)}</span>
                  <span className="text-right text-slate-500">{bid.total.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Trade Execution Tape Column */}
        <div className="col-span-5 flex flex-col min-h-0">
          <div
            className="flex items-center justify-between px-2 py-1 text-[10px] font-mono border-b text-slate-400 font-semibold"
            style={{ borderColor: 'var(--ot-border)' }}
          >
            <span>TIME & SALES</span>
            <Activity className="w-3 h-3 text-emerald-400" />
          </div>

          <div
            className="grid grid-cols-3 px-2 py-0.5 text-[9px] font-mono text-slate-400 border-b"
            style={{ borderColor: 'var(--ot-border)' }}
          >
            <div>PRICE</div>
            <div className="text-right">QTY</div>
            <div className="text-right">TIME</div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y font-mono text-[10px] tabular-nums" style={{ borderColor: 'var(--ot-border)' }}>
            {trades.length === 0 ? (
              <div className="p-3 text-center text-slate-500">Streaming live execution tape...</div>
            ) : (
              trades.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-3 px-2 py-0.5 items-center hover:bg-slate-800/30"
                >
                  <span
                    className="font-semibold"
                    style={{ color: t.side === 'buy' ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                  >
                    ${t.price.toFixed(2)}
                  </span>
                  <span className="text-right text-slate-300">{t.amount.toFixed(4)}</span>
                  <span className="text-right text-slate-500">{t.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
