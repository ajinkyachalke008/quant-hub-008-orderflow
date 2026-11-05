import React from 'react';
import { MACRO_DATA } from '../../services/marketData';
import { Globe, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const MacroWidget: React.FC = () => {
  const [macroItems, setMacroItems] = React.useState(MACRO_DATA);

  React.useEffect(() => {
    const loadRealMacro = async () => {
      try {
        const resp = await fetch('/api/macro');
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setMacroItems(data);
          }
        }
      } catch (_) {}
    };
    loadRealMacro();
  }, []);
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
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            MACRO & YIELD CURVE
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">FRED & RATES</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">US SOVEREIGN DEBT</span>
      </div>

      {/* Yield Curve Visualizer Strip */}
      <div
        className="p-3 border-b space-y-2"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
          <span>US TREASURY BENCHMARK CURVE</span>
          <span style={{ color: 'var(--ot-cyan)' }}>SPREAD (10Y - 2Y): +16 bps</span>
        </div>

        <div className="flex items-end justify-between h-14 pt-2 gap-2">
          {[
            { term: '3M', yield: '4.62%' },
            { term: '6M', yield: '4.48%' },
            { term: '2Y', yield: '4.08%' },
            { term: '5Y', yield: '4.12%' },
            { term: '10Y', yield: '4.24%' },
            { term: '30Y', yield: '4.51%' },
          ].map((item, idx) => {
            const num = parseFloat(item.yield);
            const heightPct = ((num - 3.8) / (4.8 - 3.8)) * 100;
            return (
              <div key={item.term} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-slate-200">{item.yield}</span>
                <div className="w-full bg-slate-800 rounded-t h-8 relative flex items-end">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(15, heightPct)}%`,
                      backgroundColor: idx === 4 ? 'var(--ot-amber)' : 'var(--ot-cyan)',
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400">{item.term}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Macro Indicators List */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--ot-border)' }}>
        {macroItems.map((item) => {
          const deltaColor =
            item.deltaType === 'up'
              ? 'var(--ot-profit)'
              : item.deltaType === 'down'
              ? 'var(--ot-loss)'
              : 'var(--ot-text-secondary)';

          return (
            <div
              key={item.id}
              className="p-3 space-y-1 hover:bg-slate-800/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-100">{item.name}</span>
                  <span className="text-[10px] text-slate-400">{item.category}</span>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-slate-100">{item.value}</div>
                  <div
                    className="text-[11px] font-mono font-medium flex items-center justify-end gap-0.5"
                    style={{ color: deltaColor }}
                  >
                    {item.deltaType === 'up' ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : item.deltaType === 'down' ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    <span>{item.change}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
