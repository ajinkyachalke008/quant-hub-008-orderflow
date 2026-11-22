import React, { useEffect, useState } from 'react';
import { HeatmapCanvas } from './HeatmapCanvas';
import { FuturesContextPanel } from './FuturesContextPanel';
import { FeedStatusBadge } from '../widg e s/FeedStatusBadge';
import { FootprintCanvas } from './FootprintCanvas';
import { TradeTape } from './TradeTape';
import { OrderBookLadder } from './OrderBookLadder';
import { DecisionPanel } from '../widg e s/DecisionPanel';
import { DangerMeter } from '../widg e s/DangerMeter';
import { LiquidationFeed } from '../widg e s/LiquidationFeed';
import { RegimeBadge } from '../widg es/RegimeBadge';
import { WhaleFeed } from '../widg es/WhaleFeed';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { GammaExposureService } from '../../services/gammaExposureService';
import { GEXPanel } from './GEXPanel';
import { OptionsChain } from '../widg e s/OptionsChain';
import { CrossExchangeSpread } from './CrossExchangeSpread';
import { OHLCVChart } from './OHLCVChart';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

export const OrderFlowTerminalWidget: React.FC = () => {
  const symbol = useOrderFlowStore((s) => s.symbol);
  const setSymbol = useOrderFlowStore((s) => s.setSymbol);
  const feedStates = useOrderFlowStore((s) => s.feedStates);
  const gexProfile = useOrderFlowStore((s) => s.gexProfile);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '[') setLeftCollapsed((v) => !v);
      if (e.key === ']') setRightCollapsed((v) => !v);
      if (e.key === 'l' || e.key === 'L') useOrderFlowStore.getState().setFeedState('heatmap', 'LIVE');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const feedOk = Object.values(feedStates).every((v) => v === 'CONNECTING' || v === 'LIVE');

  useEffect(() => {
    const svc = new GammaExposureService();
    svc.start(0, (p) => useOrderFlowStore.getState().setGEXProfile(p));
    return () => svc.stop();
  }, []);

  return (
    <div aria-label="Order Flow Terminal" className="flex flex-col h-full w-full min-h-0" style={{ backgroundColor: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', color: 'var(--ot-text-primary)' }}>
      <div className="px-3 py-2 bg-[var(--ot-bg-surface)] border-b border-[var(--ot-border)] flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider text-xs text-[var(--ot-accent)]">ORDER FLOW TERMINAL</span>
        <div className="flex items-center gap-2">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ backgroundColor: 'var(--ot-bg-surface)', color: 'var(--ot-text-primary)', border: '1px solid var(--ot-border)' }}>
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span role="status" className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: feedOk ? 'var(--ot-profit)' : 'var(--ot-amber)', color: 'var(--ot-bg-panel)', opacity: reducedMotion ? 1 : undefined, animation: reducedMotion ? 'none' : undefined }}>
            {feedOk ? 'LIVE' : 'CONNECTING'}
          </span>
          <div role="status" className="flex items-center gap-1">
            {Object.keys(feedStates).map((f) => <FeedStatusBadge key={f} feed={f} />)}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: `${leftCollapsed ? '0px' : '220px'} 1fr ${rightCollapsed ? '0px' : '280px'}` }}>
        <div className="overflow-y-auto border-r border-[var(--ot-border)]" style={{ display: leftCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
          <DecisionPanel />
          <RegimeBadge />
          <DangerMeter />
        </div>
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ gap: 8, padding: 8 }}>
          <div className="flex-1 min-h-0"><HeatmapCanvas /></div>
          <div className="flex-1 min-h-0"><FootprintCanvas /></div>
        </div>
        <div className="overflow-y-auto border-l border-[var(--ot-border)]" style={{ display: rightCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
          <div className="min-h-0" style={{ flex: '1 1 0', minHeight: 160 }}><OrderBookLadder /></div>
          <div className="min-h-0" style={{ flex: '1 1 0', minHeight: 160 }}><TradeTape /></div>
          <div className="min-h-0 overflow-auto" style={{ flex: '1 1 0', minHeight: 160 }}><WhaleFeed /></div>
          <div className="min-h-0" style={{ flex: '1 1 0', minHeight: 160 }}><LiquidationFeed /></div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--ot-border)', padding: 8, display: 'flex', gap: 8 }}>
        <GEXPanel />
        <OptionsChain options={gexProfile?.options ?? []} underlyingPrice={gexProfile?.spot ?? 0} />
      </div>
      <div style={{ height: bottomCollapsed ? 48 : 200, borderTop: '1px solid var(--ot-border)' }}>
        <button aria-pressed={bottomCollapsed} onClick={() => setBottomCollapsed((v) => !v)} style={{ width: '100%', height: 48 }}>Toggle Bottom</button>
        {!bottomCollapsed && <FuturesContextPanel />}
      </div>
      <div role="status" className="sr-only" />
    </div>
  );
};

