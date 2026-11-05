import React from 'react';
import { useTerminal } from '../context/TerminalContext';
import { LayoutMode } from '../types/terminal';
import {
  LayoutDashboard,
  LineChart,
  Coins,
  Globe,
  SlidersHorizontal,
  LayoutGrid,
  Terminal,
  Layers,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    layout,
    setLayout,
    widgets,
    toggleWidgetVisibility,
    activeDataSource,
    connectionLatency,
    connectionState,
    activeSymbol,
    setActiveSymbol,
  } = useTerminal();

  const navItems: {
    id: LayoutMode;
    label: string;
    sublabel: string;
    hotkey: string;
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  }[] = [
    { id: 'xauusd', label: 'Bullion XAU/USD', sublabel: 'GOLD SPOT', hotkey: '1', icon: Coins },
    { id: 'default', label: 'Workspace Grid', sublabel: 'ALL ASSETS', hotkey: '2', icon: LayoutDashboard },
    { id: 'trading', label: 'Equity Desk', sublabel: 'STOCKS', hotkey: '3', icon: LineChart },
    { id: 'crypto', label: 'Crypto Board', sublabel: '24/7 SPOT', hotkey: '4', icon: Layers },
    { id: 'macro', label: 'Macro & Yields', sublabel: 'FRED RATES', hotkey: '5', icon: Globe },
    { id: 'cli-focused', label: 'CLI Console', sublabel: 'TERMINAL SHELL', hotkey: '6', icon: Terminal },
  ];

  // Map of which widgets are relevant per layout
  const layoutWidgetMap: Record<LayoutMode, string[]> = {
    xauusd: ['chart', 'xau-telemetry', 'xau-orderbook', 'watchlist', 'macro', 'news', 'cli', 'crypto-ticker'],
    trading: ['chart', 'quote', 'watchlist', 'screener', 'cli', 'crypto-ticker'],
    crypto: ['crypto', 'chart', 'news', 'heatmap', 'cli', 'crypto-ticker'],
    macro: ['macro', 'chart', 'quote', 'news', 'cli', 'crypto-ticker'],
    'cli-focused': ['cli', 'chart', 'quote', 'watchlist', 'crypto-ticker'],
    default: ['chart', 'quote', 'watchlist', 'news', 'macro', 'crypto', 'screener', 'heatmap', 'cli', 'crypto-ticker'],
  };

  const handleLayoutSelect = (id: LayoutMode) => {
    setLayout(id);
    if (id === 'xauusd') {
      setActiveSymbol('XAU/USD');
    } else if (id === 'crypto') {
      if (!['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX'].includes(activeSymbol)) {
        setActiveSymbol('BTC');
      }
    } else if (id === 'trading') {
      if (['XAU/USD', 'US10Y'].includes(activeSymbol)) {
        setActiveSymbol('NVDA');
      }
    } else if (id === 'macro') {
      if (['XAU/USD', 'BTC', 'ETH', 'SOL'].includes(activeSymbol)) {
        setActiveSymbol('US10Y');
      }
    }
  };

  // Keyboard shortcut listener (Alt + 1..6)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const item = navItems[parseInt(e.key, 10) - 1];
        if (item) handleLayoutSelect(item.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSymbol]);

  const activeWidgetsInCurrentLayout = layoutWidgetMap[layout] || [];

  return (
    <aside
      className="hidden md:flex flex-col w-60 border-r shrink-0 select-none"
      style={{
        borderColor: 'var(--ot-border)',
        backgroundColor: 'var(--ot-bg-surface)',
      }}
    >
      {/* Views Section */}
      <div className="p-3 space-y-2 border-b" style={{ borderColor: 'var(--ot-border)' }}>
        {/* Selected element with enhanced high-contrast styling */}
        <div
          className="px-2.5 py-1.5 text-[10px] font-mono font-bold tracking-wider flex items-center justify-between border rounded"
          style={{
            borderColor: 'var(--ot-border)',
            backgroundColor: 'var(--ot-bg-panel)',
            color: 'var(--ot-text-secondary)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
              style={{ backgroundColor: 'var(--ot-profit)' }}
            />
            <span className="tracking-widest uppercase font-semibold" style={{ color: 'var(--ot-text-primary)' }}>
              LAYOUT MODES
            </span>
          </div>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold tracking-widest uppercase"
            style={{
              borderColor: 'var(--ot-border)',
              color: 'var(--ot-amber)',
              backgroundColor: 'var(--ot-bg-root)',
            }}
          >
            ACTIVE: {layout.toUpperCase()}
          </span>
        </div>

        {/* Layout Mode Nav Buttons */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = layout === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleLayoutSelect(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-mono rounded transition-all text-left cursor-pointer group ${
                  isActive
                    ? 'font-bold shadow-xs'
                    : 'hover:brightness-125'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--ot-bg-hover)',
                        color: 'var(--ot-amber)',
                        borderColor: 'var(--ot-amber)',
                        borderWidth: '1px 1px 1px 3px',
                        borderStyle: 'solid',
                      }
                    : {
                        color: 'var(--ot-text-secondary)',
                        backgroundColor: 'transparent',
                        border: '1px solid transparent',
                      }
                }
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className="w-3.5 h-3.5 shrink-0 transition-colors"
                    style={{ color: isActive ? 'var(--ot-amber)' : 'var(--ot-text-muted)' }}
                  />
                  <div className="flex flex-col truncate">
                    <span
                      className="truncate leading-tight"
                      style={{ color: isActive ? 'var(--ot-amber)' : 'var(--ot-text-primary)' }}
                    >
                      {item.label}
                    </span>
                    <span className="text-[9px] opacity-60 font-mono tracking-wider">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[9px] px-1 py-0.2 rounded font-mono opacity-50 group-hover:opacity-100 hidden lg:inline"
                    style={{
                      color: 'var(--ot-text-muted)',
                      backgroundColor: 'var(--ot-bg-surface)',
                      border: '1px solid var(--ot-border)',
                    }}
                    title={`Shortcut: Alt+${item.hotkey}`}
                  >
                    ⌥{item.hotkey}
                  </span>
                  {isActive && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase"
                      style={{
                        color: 'var(--ot-cyan)',
                        backgroundColor: 'rgba(0, 240, 255, 0.12)',
                        border: '1px solid rgba(0, 240, 255, 0.35)',
                      }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Widget Visibility Toggles */}
      <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        <div
          className="flex items-center justify-between px-2 py-1 text-[10px] font-mono font-semibold tracking-wider"
          style={{ color: 'var(--ot-text-secondary)' }}
        >
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" style={{ color: 'var(--ot-cyan)' }} />
            <span>ACTIVE WIDGETS</span>
          </div>
          <span className="text-[9px] font-mono opacity-70">
            {widgets.filter((w) => w.visible && activeWidgetsInCurrentLayout.includes(w.id)).length} / {activeWidgetsInCurrentLayout.length} IN VIEW
          </span>
        </div>

        <div className="space-y-0.5">
          {widgets.map((w) => {
            const isInCurrentLayout = activeWidgetsInCurrentLayout.includes(w.id);
            return (
              <div
                key={w.id}
                onClick={() => toggleWidgetVisibility(w.id)}
                className={`flex items-center justify-between px-2.5 py-1 text-xs font-mono rounded cursor-pointer transition-colors ${
                  isInCurrentLayout ? 'hover:bg-slate-800/30' : 'opacity-40 hover:opacity-80'
                }`}
                title={isInCurrentLayout ? 'Click to toggle visibility' : 'Widget not part of current layout template'}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: !isInCurrentLayout
                        ? 'var(--ot-text-muted)'
                        : w.visible
                        ? 'var(--ot-profit)'
                        : 'var(--ot-loss)',
                    }}
                  />
                  <span
                    className={`truncate ${
                      !w.visible ? 'line-through opacity-50' : ''
                    }`}
                    style={{
                      color: w.visible ? 'var(--ot-text-primary)' : 'var(--ot-text-muted)',
                    }}
                  >
                    {w.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {!isInCurrentLayout && (
                    <span className="text-[8px] font-mono opacity-60 text-slate-500">
                      OFF-LAYOUT
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color: !isInCurrentLayout
                        ? 'var(--ot-text-muted)'
                        : w.visible
                        ? 'var(--ot-cyan)'
                        : 'var(--ot-text-muted)',
                    }}
                  >
                    {w.visible ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Status Footprint */}
      <div
        className="p-3 border-t text-[10px] font-mono space-y-1.5"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-root)',
          color: 'var(--ot-text-secondary)',
        }}
      >
        <div className="flex justify-between items-center">
          <span>ACTIVE STREAM:</span>
          <span
            className="font-bold truncate max-w-[130px] text-right"
            style={{ color: connectionState.status === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)' }}
          >
            {connectionState.activeSource}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>STREAM STATUS:</span>
          <span
            className="font-bold uppercase text-[9px] px-1 py-0.2 rounded border"
            style={{
              borderColor: connectionState.status === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)',
              color: connectionState.status === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)',
              backgroundColor: 'var(--ot-bg-surface)',
            }}
          >
            {connectionState.status}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>PYTH ORACLE:</span>
          <span
            className="font-bold text-[9px] truncate max-w-[120px] text-right"
            style={{
              color: connectionState.pythStatus === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)',
            }}
          >
            {connectionState.pythStatus}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>LATENCY:</span>
          <span className="text-emerald-400 font-bold">{connectionState.latencyMs}ms</span>
        </div>
        <div className="flex justify-between items-center">
          <span>ORACLE SPREAD:</span>
          <span className="text-amber-400 font-bold">±${connectionState.confidence.toFixed(2)}</span>
        </div>
      </div>
    </aside>
  );
};
