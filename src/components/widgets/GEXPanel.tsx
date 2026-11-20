import React from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { computeGexProfile } from '../../lib/orderflow/gexCalculator';

export const GEXPanel: React.FC = () => {
  const gexProfile = useOrderFlowStore((s) => s.gexProfile);
  const feedStates = useOrderFlowStore((s) => s.feedStates);

  if (!gexProfile) {
    return (
      <div style={{ background: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', borderRadius: 8, padding: 12 }}>
        <div style={{ color: 'var(--ot-text-primary)', fontWeight: 700, marginBottom: 8 }}>GAMMA EXPOSURE (GEX)</div>
        <div style={{ color: 'var(--ot-text-muted)', fontSize: 12 }}>Loading...</div>
        <div style={{ marginTop: 8, height: 120, background: 'var(--ot-bg-surface)', borderRadius: 4, opacity: 0.5 }} />
      </div>
    );
  }

  const { spot, flipStrike, gammaProfile, timestamp } = gexProfile;
  let callWall: number | null = null;
  let putWall: number | null = null;
  let maxCall = -Infinity;
  let maxPut = -Infinity;
  for (const g of gammaProfile) {
    if (g.callGamma > maxCall) { maxCall = g.callGamma; callWall = g.strike; }
    if (g.putGamma < maxPut) { maxPut = g.putGamma; putWall = g.strike; }
  }
  const maxAbs = Math.max(...gammaProfile.map((g) => Math.abs(g.netGamma)), 1);
  const ago = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  const feeds = Object.values(feedStates);
  const feedStatus = feeds.length ? feeds[feeds.length - 1] : 'CONNECTING';

  void computeGexProfile;

  return (
    <div style={{ background: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', borderRadius: 8, padding: 12, color: 'var(--ot-text-primary)', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>GAMMA EXPOSURE (GEX)</div>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--ot-bg-surface)', border: '1px solid var(--ot-border)', color: 'var(--ot-text-secondary)' }}>{feedStatus}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 8 }}>
        <div>Spot: <span style={{ color: 'var(--ot-cyan)' }}>{spot.toFixed(2)}</span></div>
        <div>Flip: <span style={{ color: 'var(--ot-amber)' }}>{flipStrike != null ? flipStrike.toFixed(2) : '—'}</span></div>
        <div>Call Wall: <span style={{ color: 'var(--ot-profit)' }}>{callWall != null ? callWall.toFixed(2) : '—'}</span></div>
        <div>Put Wall: <span style={{ color: 'var(--ot-loss)' }}>{putWall != null ? putWall.toFixed(2) : '—'}</span></div>
        <div>Max Pain: <span style={{ color: 'var(--ot-text-secondary)' }}>—</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
        {gammaProfile.map((g) => {
          const w = (Math.abs(g.netGamma) / maxAbs) * 100;
          const pos = g.netGamma >= 0;
          return (
            <div key={g.strike} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
              <div style={{ width: 52, color: 'var(--ot-text-muted)' }}>{g.strike.toFixed(0)}</div>
              <div style={{ flex: 1, height: 8, background: 'var(--ot-bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', background: pos ? 'var(--ot-profit)' : 'var(--ot-loss)' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ot-text-muted)' }}>GEX last updated: {ago}s ago</div>
    </div>
  );
};

export default GEXPanel;
