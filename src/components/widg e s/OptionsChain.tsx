import React, { useMemo, useState } from 'react';
import { NormalizedOption } from '../../types/orderFlow';

type Filter = 'all' | 'call' | 'put';

interface OptionsChainProps {
  options: NormalizedOption[];
  underlyingPrice?: number;
}

export function OptionsChain({ options, underlyingPrice = 0 }: OptionsChainProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [expiryFilter, setExpiryFilter] = useState<number | 'all'>('all');

  const expiries = useMemo(() => {
    const unique = new Set(options.map((o) => o.expiry));
    return Array.from(unique).sort();
  }, [options]);

  const filteredOptions = useMemo(() => {
    let data = options.filter((o) => filter === 'all' || o.optionType === filter);
    if (expiryFilter !== 'all') {
      data = data.filter((o) => o.expiry === expiryFilter);
    }
    return [...data].sort((a, b) => (dir === 'asc' ? a.strike - b.strike : b.strike - a.strike));
  }, [options, filter, dir, expiryFilter]);

  const rowTint = (type: 'call' | 'put') =>
    type === 'call'
      ? 'color-mix(in srgb, var(--ot-profit) 12%, transparent)'
      : 'color-mix(in srgb, var(--ot-loss) 12%, transparent)';

  const getIvColor = (iv: number) => {
    if (iv > 60) return 'var(--ot-loss)';
    if (iv >= 40) return 'var(--ot-amber)';
    return 'var(--ot-profit)';
  };

  const getOiColor = (oi: number) => (oi > 1000 ? 'var(--ot-cyan)' : 'var(--ot-text-primary)');

  const atmOption = useMemo(() => {
    if (!underlyingPrice || options.length === 0) return null;
    return options.reduce((closest, opt) => {
      const diff = Math.abs(opt.strike - underlyingPrice);
      const closestDiff = Math.abs(closest.strike - underlyingPrice);
      return diff < closestDiff ? opt : closest;
    }, options[0]);
  }, [options, underlyingPrice]);

  const callOi = useMemo(
    () => options.filter((o) => o.optionType === 'call').reduce((sum, o) => sum + o.openInterest, 0),
    [options]
  );
  const putOi = useMemo(
    () => options.filter((o) => o.optionType === 'put').reduce((sum, o) => sum + o.openInterest, 0),
    [options]
  );

  const thStyle = {
    padding: '8px 10px',
    color: 'var(--ot-text-muted)',
    fontWeight: 600,
    fontSize: 11,
    backgroundColor: 'var(--ot-bg-surface)',
    borderBottom: '1px solid var(--ot-border)',
  };
  const tdStyle = { padding: '7px 10px', color: 'var(--ot-text-primary)', borderBottom: '1px solid var(--ot-border)' };
  const pillStyle = (f: Filter) => ({
    padding: '2px 8px',
    fontSize: 10,
    border: '1px solid var(--ot-border)',
    backgroundColor: filter === f ? 'var(--ot-bg-hover)' : 'transparent',
    color: 'var(--ot-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
  });
  const expiryPillStyle = (active: boolean) => ({
    padding: '2px 8px',
    fontSize: 10,
    border: '1px solid var(--ot-border)',
    backgroundColor: active ? 'var(--ot-bg-hover)' : 'transparent',
    color: 'var(--ot-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
  });

  if (!filteredOptions.length)
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ot-text-muted)' }}>
        No options data
      </div>
    );

  return (
    <div style={{ backgroundColor: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', borderRadius: 8 }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--ot-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ot-text-secondary)',
          }}
        >
          OPTIONS CHAIN
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {(['all', 'call', 'put'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={pillStyle(f)}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--ot-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--ot-text-muted)', fontWeight: 600 }}>Expiry:</span>
        <button onClick={() => setExpiryFilter('all')} style={expiryPillStyle(expiryFilter === 'all')}>
          All
        </button>
        {expiries.map((exp) => (
          <button key={exp} onClick={() => setExpiryFilter(exp)} style={expiryPillStyle(expiryFilter === exp)}>
            {new Date(exp).toLocaleDateString()}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          fontSize: 11,
        }}
      >
        <span style={{ color: 'var(--ot-profit)', fontWeight: 600 }}>
          Call OI: {callOi.toLocaleString()}
        </span>
        <span style={{ color: 'var(--ot-loss)', fontWeight: 600 }}>
          Put OI: {putOi.toLocaleString()}
        </span>
        {atmOption && (
          <span style={{ color: 'var(--ot-cyan)', fontWeight: 600 }}>
            ATM IV ({atmOption.strike}): {atmOption.markIv.toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={thStyle}>Instrument</th>
              <th
                style={{
                  ...thStyle,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              >
                Strike{' '}
                <span style={{ color: 'var(--ot-text-muted)' }}>
                  {dir === 'asc' ? '\u25B2' : '\u25BC'}
                </span>
              </th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Expiry</th>
              <th style={thStyle}>Mark IV (%)</th>
              <th style={thStyle}>Open Interest</th>
            </tr>
          </thead>
          <tbody>
            {filteredOptions.map((o) => (
              <tr
                key={`${o.instrumentName}--`}
                style={{ backgroundColor: rowTint(o.optionType), borderBottom: '1px solid var(--ot-border)' }}
              >
                <td style={tdStyle}>{o.instrumentName}</td>
                <td style={tdStyle}>{o.strike}</td>
                <td
                  style={{
                    ...tdStyle,
                    color: o.optionType === 'call' ? 'var(--ot-profit)' : 'var(--ot-loss)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {o.optionType === 'call' ? 'Call' : 'Put'}
                </td>
                <td style={tdStyle}>{new Date(o.expiry).toLocaleDateString()}</td>
                <td style={{ ...tdStyle, color: getIvColor(o.markIv), fontWeight: 600 }}>
                  {o.markIv.toFixed(1)}%
                </td>
                <td style={{ ...tdStyle, color: getOiColor(o.openInterest), fontWeight: 600 }}>
                  {o.openInterest.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
