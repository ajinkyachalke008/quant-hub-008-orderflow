import React, { useEffect, useRef } from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import type { FeedState } from '../../types/orderFlow';

export const TradeTape: React.FC = () => {
  const listRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const rows = new Map<string, HTMLElement>();

  const feedColor = (s: FeedState) =>
    s === 'LIVE' ? 'var(--ot-profit)' : s === 'DISCONNECTED' ? 'var(--ot-loss)' : s === 'STALE' ? 'var(--ot-text-muted)' : 'var(--ot-amber)';

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleTimeString(undefined, { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  };

  useEffect(() => {
    const list = listRef.current!;
    const badge = badgeRef.current!;
    const style = document.createElement('style');
    style.textContent = `.ot-row{animation:tapeEnter 150ms ease-out both}@keyframes tapeEnter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes ot-pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}`;
    document.head.appendChild(style);

    const sync = () => {
      const { trades, feedStates } = useOrderFlowStore.getState();
      const states = Object.values(feedStates);
      badge.textContent = states.length ? states.join(' / ') : 'DISCONNECTED';
      badge.style.color = feedColor(states[states.length - 1] || 'DISCONNECTED');

      if (!trades.length) {
        list.innerHTML = `<div style="padding:8px;display:flex;flex-direction:column;gap:6px"><div style="height:8px;width:40%;background:var(--ot-bg-surface);border-radius:4px;animation:ot-pulse 1.4s ease-in-out infinite"></div><div style="height:8px;width:60%;background:var(--ot-bg-surface);border-radius:4px;animation:ot-pulse 1.4s ease-in-out infinite"></div><div style="height:8px;width:50%;background:var(--ot-bg-surface);border-radius:4px;animation:ot-pulse 1.4s ease-in-out infinite"></div></div>`;
        rows.clear();
        return;
      }

      const want = new Set(trades.map((t) => t.tradeId));
      for (const [id, node] of rows) if (!want.has(id)) { node.remove(); rows.delete(id); }
      for (let i = trades.length - 1; i >= 0; i--) {
        const t = trades[i];
        if (rows.has(t.tradeId)) continue;
        const whale = t.quoteQty >= 5000;
        const sideColor = t.side === 'buy' ? 'var(--ot-profit)' : 'var(--ot-loss)';
        const node = document.createElement('div');
        node.className = 'ot-row';
        node.style.cssText = `display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-bottom:1px solid var(--ot-border);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ot-text-primary);${whale ? 'border-left:3px solid var(--ot-cyan);background:var(--ot-bg-hover)' : ''}`;
        node.dataset.id = t.tradeId;
        node.innerHTML = `<span style="color:var(--ot-text-muted)">${fmt(t.timestamp)}</span><span style="color:var(--ot-text-secondary)">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span style="color:var(--ot-text-secondary)">${t.qty}</span><span style="color:${sideColor};font-weight:bold">${t.side.toUpperCase()}</span>${whale ? `<span style="border:1px solid var(--ot-cyan);color:var(--ot-cyan);padding:0 5px;border-radius:2px;font-size:10px">WHALE ${t.quoteQty.toFixed(0)}</span>` : ''}`;
        list.prepend(node);
        rows.set(t.tradeId, node);
      }
    };

    sync();
    const unsub = useOrderFlowStore.subscribe(sync);
    return () => { unsub(); style.remove(); };
  }, []);

  return (
    <div className="flex flex-col h-full border rounded overflow-hidden" style={{ backgroundColor: 'var(--ot-bg-panel)', borderColor: 'var(--ot-border)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}>
        <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>TRADE TAPE</span>
        <span ref={badgeRef} className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: 'var(--ot-border)' }}>DISCONNECTED</span>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto" />
    </div>
  );
};
