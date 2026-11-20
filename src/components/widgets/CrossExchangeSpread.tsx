import { useOrderFlowStore } from '../../stores/orderFlowStore';

export function CrossExchangeSpread({ bybitPrice }: { bybitPrice: number }) {
  const depth = useOrderFlowStore((s) => s.depth);
  const feed = useOrderFlowStore((s) => s.feedStates['binance-futures'] ?? 'DISCONNECTED');

  const bestBid = depth?.bids[0]?.price ?? 0;
  const bestAsk = depth?.asks[0]?.price ?? 0;
  const binanceMid = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;

  const spreadBps = binanceMid > 0 ? ((bybitPrice - binanceMid) / binanceMid) * 10000 : 0;
  const spreadPct = spreadBps / 100;
  const absPct = Math.abs(spreadPct);

  const color = absPct > 0.25 ? 'var(--ot-loss)' : absPct > 0.10 ? 'var(--ot-amber)' : 'var(--ot-profit)';

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        borderRadius: 6,
        border: '1px solid var(--ot-border)',
        backgroundColor: 'var(--ot-bg-panel)',
        color: 'var(--ot-text-primary)',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, letterSpacing: 0.1, textTransform: 'uppercase', color: 'var(--ot-text-secondary)', fontSize: 11 }}>CROSS-EXCHANGE SPREAD</div>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, border: '1px solid var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)', color: 'var(--ot-text-muted)' }}>{feed}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{spreadBps.toFixed(1)} bp</span>
        <span style={{ color: 'var(--ot-text-muted)' }}>{spreadPct.toFixed(2)}%</span>
      </div>
      {Math.abs(spreadBps) > 50 && (
        <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, backgroundColor: 'var(--ot-loss)', color: 'var(--ot-bg-root)' }}>ALERT: spread &gt;50 bp</div>
      )}
    </section>
  );
}
