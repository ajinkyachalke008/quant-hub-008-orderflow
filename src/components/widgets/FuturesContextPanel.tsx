import React from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { FuturesContext, NormalizedMarkPrice } from '../../types/orderFlow';

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(r: number | null | undefined): string {
  if (r == null) return '\u2014';
  return (r * 100).toFixed(4) + '%';
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '\u2014';
  const diff = ts - Date.now();
  if (diff > 0) {
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  return new Date(ts).toLocaleTimeString();
}

function FeedBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    LIVE: 'var(--ot-profit)',
    CONNECTING: 'var(--ot-amber)',
    RECONNECTING: 'var(--ot-amber)',
    DELAYED: 'var(--ot-amber)',
    STALE: 'var(--ot-loss)',
    DISCONNECTED: 'var(--ot-text-muted)',
    ERROR: 'var(--ot-loss)',
    UNSUPPORTED: 'var(--ot-text-muted)',
  };
  return (
    <span style={{ color: colors[state] || 'var(--ot-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
      {state}
    </span>
  );
}

export function FuturesContextPanel() {
  const markPrice = useOrderFlowStore(s => s.markPrice);
  const futuresContext = useOrderFlowStore(s => s.futuresContext);
  const feedStates = useOrderFlowStore(s => s.feedStates);

  const mp = markPrice;
  const fc = futuresContext;

  const mark = mp?.markPrice ?? fc?.markPrice ?? null;
  const index = mp?.indexPrice ?? fc?.indexPrice ?? null;
  const funding = mp?.fundingRate ?? fc?.fundingRate ?? null;
  const nextFunding = mp?.nextFundingTime ?? fc?.nextFundingTime ?? null;
  const oi = fc?.openInterest ?? null;
  const oiUsd = fc?.openInterestUsd ?? null;

  const markHigher = mark != null && index != null && mark > index;

  return (
    <div style={{
      background: 'var(--ot-bg-panel)',
      border: '1px solid var(--ot-border)',
      borderRadius: 8,
      padding: 16,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      color: 'var(--ot-text-primary)',
      minWidth: 260,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>FUTURE CONTEXT</span>
        <FeedBadge state={Object.values(feedStates).find(s => s !== 'LIVE') || 'LIVE'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px' }}>
        <span style={{ color: 'var(--ot-text-secondary)' }}>Mark Price</span>
        <span style={{ color: markHigher ? 'var(--ot-profit)' : 'var(--ot-loss)', fontWeight: 600 }}>{fmtNum(mark)}</span>

        <span style={{ color: 'var(--ot-text-secondary)' }}>Index Price</span>
        <span style={{ color: !markHigher && mark != null && index != null ? 'var(--ot-profit)' : 'var(--ot-loss)', fontWeight: 600 }}>{fmtNum(index)}</span>

        <span style={{ color: 'var(--ot-text-secondary)' }}>Funding Rate</span>
        <span style={{ color: funding != null && funding > 0 ? 'var(--ot-loss)' : 'var(--ot-profit)', fontWeight: 600 }}>{fmtPct(funding)}</span>

        <span style={{ color: 'var(--ot-text-secondary)' }}>Next Funding</span>
        <span style={{ color: 'var(--ot-text-primary)' }}>{fmtTime(nextFunding)}</span>

        <span style={{ color: 'var(--ot-text-secondary)' }}>Open Interest</span>
        <span style={{ color: 'var(--ot-text-primary)' }}>
          {fmtNum(oi)} {oiUsd != null ? `($${fmtNum(oiUsd / 1e6)}M)` : ''}
        </span>
      </div>
    </div>
  );
}
