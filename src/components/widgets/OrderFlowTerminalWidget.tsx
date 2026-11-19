import React from 'react';

export const OrderFlowTerminalWidget: React.FC = () => {
  return (
    <div
      className="flex flex-col h-full w-full min-h-0"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        border: '1px solid var(--ot-border)',
        color: 'var(--ot-text-primary)',
      }}
    >
      <div className="px-3 py-2 bg-[var(--ot-bg-surface)] border-b border-[var(--ot-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ot-amber)' }} />
          <span className="font-bold uppercase tracking-wider text-xs text-[var(--ot-accent)]">Order Flow Terminal</span>
        </div>
        <span className="text-[10px] text-[var(--ot-text-muted)] font-mono">Stage 0: data layer connecting…</span>
      </div>
      <div className="flex-1 p-4 overflow-hidden min-h-0 flex flex-col items-center justify-center">
        <p className="text-xs font-mono text-center text-[var(--ot-text-secondary)] leading-relaxed">
          Order Flow Terminal — Stage 0: data layer connecting…
        </p>
        <p className="mt-2 text-[10px] text-[var(--ot-text-muted)] font-mono text-center">
          Binance Futures adapter + Zustand store initializing. No data rendered yet.
        </p>
      </div>
    </div>
  );
};
