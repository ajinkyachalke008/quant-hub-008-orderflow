import React, { useMemo, useState } from 'react';
import { NormalizedOption } from '../../types/orderFlow';

type Filter = 'all' | 'call' | 'put';

export function OptionsChain({ options }: { options: NormalizedOption[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(() => {
    let data = options.filter((o) => filter === 'all' || o.optionType === filter);
    return [...data].sort((a, b) => (dir === 'asc' ? a.strike - b.strike : b.strike - a.strike));
  }, [options, filter, dir]);

  const rowTint = (type: 'call' | 'put') =>
    type === 'call' ? 'color-mix(in srgb, var(--ot-profit) 12%, transparent)' : 'color-mix(in srgb, var(--ot-loss) 12%, transparent)';

  const thStyle = { padding: '8px 10px', color: 'var(--ot-text-muted)', fontWeight: 600, fontSize: 11, backgroundColor: 'var(--ot-bg-surface)', borderBottom: `1px solid var(--ot-border)` };
  const tdStyle = { padding: '7px 10px', color: 'var(--ot-text-primary)', borderBottom: `1px solid var(--ot-border)` };
  const pillStyle = (f: Filter) => ({ padding: '2px 8px', fontSize: 10, border: `1px solid var(--ot-border)`, backgroundColor: filter === f ? 'var(--ot-bg-hover)' : 'transparent', color: 'var(--ot-text-secondary)', borderRadius: 4, cursor: 'pointer' });

  if (!rows.length) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--ot-text-muted)' }}>No options data</div>;

  return (
    <div style={{ backgroundColor: 'var(--ot-bg-panel)', border: `1px solid var(--ot-border)`, borderRadius: 8 }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid var(--ot-border)`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ot-text-secondary)' }}>OPTIONS CHAIN</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {['all', 'call', 'put'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={pillStyle(f)}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={thStyle}>Instrument</th>
            <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              Strike <span style={{ color: 'var(--ot-text-muted)' }}>{dir === 'asc' ? '?' : '?'}</span>
            </th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>Mark IV (%)</th>
            <th style={thStyle}>Open Interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={`${o.instrumentName}-${o.strike}-${o.expiry}`} style={{ backgroundColor: rowTint(o.optionType), borderBottom: `1px solid var(--ot-border)` }}>
              <td style={tdStyle}>{o.instrumentName}</td>
              <td style={tdStyle}>{o.strike}</td>
              <td style={{ ...tdStyle, color: o.optionType === 'call' ? 'var(--ot-profit)' : 'var(--ot-loss)', fontWeight: 600, textTransform: 'uppercase' }}>{o.optionType === 'call' ? 'Call' : 'Put'}</td>
              <td style={tdStyle}>{new Date(o.expiry).toLocaleDateString()}</td>
              <td style={tdStyle}>{o.markIv.toFixed(1)}%</td>
              <td style={tdStyle}>{o.openInterest.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


