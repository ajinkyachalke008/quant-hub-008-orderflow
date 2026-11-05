import React from 'react';
import { useTerminal } from '../context/TerminalContext';
import { LayoutMode, ThemeId } from '../types/terminal';
import {
  Search,
  Tv,
  Maximize2,
  Terminal as TerminalIcon,
  Activity,
  Layers,
  TrendingUp,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    theme,
    setTheme,
    scanlines,
    setScanlines,
    layout,
    setLayout,
    setIsCommandPaletteOpen,
    activeSymbol,
    setActiveSymbol,
    activeQuote,
    connectionState,
  } = useTerminal();

  const themes: { id: ThemeId; label: string }[] = [
    { id: 'hybrid', label: 'HYBRID PRO' },
    { id: 'bloomberg', label: 'BLOOMBERG' },
    { id: 'wallstreet', label: 'WALL STREET' },
    { id: 'retro', label: 'RETRO CRT' },
  ];

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

  return (
    <header className="border-b shrink-0 select-none" style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}>
      {/* Primary Top Bar: Strict 3-Zone Contract */}
      <div className="flex items-center justify-between gap-8 px-4 py-2.5">
        {/* Zone 1: Single text element brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="text-base font-bold tracking-wider uppercase cursor-pointer hover:opacity-85"
              style={{ color: 'var(--ot-amber)' }}
              onClick={() => handleLayoutSelect('default')}
            >
              OpenTerminal
            </span>
            <span
              className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded border"
              style={{
                borderColor: 'var(--ot-border)',
                color: 'var(--ot-cyan)',
                backgroundColor: 'var(--ot-bg-panel)',
              }}
            >
              v1.2.0
            </span>
            <span
              className="hidden sm:inline text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border"
              style={{
                borderColor: connectionState.status === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)',
                color: connectionState.status === 'STREAMING' ? 'var(--ot-profit)' : 'var(--ot-amber)',
                backgroundColor: connectionState.status === 'STREAMING' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 176, 0, 0.1)',
              }}
            >
              {connectionState.status === 'STREAMING' ? '● LIVE' : '▲ FAILOVER'}: {connectionState.activeSource.split(' ')[0]}
            </span>
          </div>

          <div
            className="hidden lg:flex items-center gap-2 pl-3 border-l text-xs font-mono"
            style={{ borderColor: 'var(--ot-border)', color: 'var(--ot-text-secondary)' }}
          >
            <span>FOCUS:</span>
            <span className="font-bold" style={{ color: 'var(--ot-text-primary)' }}>
              {activeSymbol}
            </span>
            <span style={{ color: activeQuote.change >= 0 ? 'var(--ot-profit)' : 'var(--ot-loss)' }}>
              ${activeQuote.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} (
              {activeQuote.change >= 0 ? '+' : ''}
              {activeQuote.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation / Layout Mode Segmented Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          <button
            onClick={() => handleLayoutSelect('xauusd')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'xauusd'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'xauusd'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            BULLION XAU/USD
          </button>
          <button
            onClick={() => handleLayoutSelect('default')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'default'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'default'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            WORKSPACE
          </button>
          <button
            onClick={() => handleLayoutSelect('trading')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'trading'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'trading'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            EQUITY DESK
          </button>
          <button
            onClick={() => handleLayoutSelect('crypto')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'crypto'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'crypto'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            CRYPTO BOARD
          </button>
          <button
            onClick={() => handleLayoutSelect('macro')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'macro'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'macro'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            MACRO & YIELDS
          </button>
          <button
            onClick={() => handleLayoutSelect('cli-focused')}
            className={`px-2.5 py-1 text-xs font-mono tracking-wide rounded transition-colors whitespace-nowrap cursor-pointer ${
              layout === 'cli-focused'
                ? 'font-semibold border shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={
              layout === 'cli-focused'
                ? {
                    backgroundColor: 'var(--ot-bg-panel)',
                    borderColor: 'var(--ot-border)',
                    color: 'var(--ot-amber)',
                  }
                : {}
            }
          >
            CLI CONSOLE
          </button>
        </nav>

        {/* Zone 3: Fast Search & 1-Click Theme Switcher Engine */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1-Click Theme Switcher */}
          <div
            className="flex items-center p-0.5 rounded border text-[11px] font-mono"
            style={{
              borderColor: 'var(--ot-border)',
              backgroundColor: 'var(--ot-bg-panel)',
            }}
          >
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`px-2 py-0.5 rounded transition-all whitespace-nowrap ${
                  theme === t.id ? 'font-bold shadow-sm' : 'opacity-60 hover:opacity-100'
                }`}
                style={
                  theme === t.id
                    ? {
                        backgroundColor: 'var(--ot-bg-hover)',
                        color: 'var(--ot-amber)',
                        border: '1px solid var(--ot-border)',
                      }
                    : { color: 'var(--ot-text-secondary)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CRT Scanline Toggle */}
          <button
            onClick={() => setScanlines(!scanlines)}
            title="Toggle Retro CRT Scanline & Phosphor Overlay"
            className={`flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border transition-colors ${
              scanlines ? 'font-bold' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              borderColor: scanlines ? 'var(--ot-cyan)' : 'var(--ot-border)',
              backgroundColor: scanlines ? 'var(--ot-bg-hover)' : 'var(--ot-bg-panel)',
              color: scanlines ? 'var(--ot-cyan)' : 'var(--ot-text-secondary)',
            }}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CRT FX</span>
          </button>

          {/* ⌘K Trigger Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors hover:brightness-110"
            style={{
              backgroundColor: 'var(--ot-bg-panel)',
              borderColor: 'var(--ot-border)',
              color: 'var(--ot-text-primary)',
            }}
          >
            <Search className="w-3 h-3" style={{ color: 'var(--ot-cyan)' }} />
            <span className="hidden sm:inline">COMMANDS</span>
            <kbd
              className="text-[10px] px-1 py-0.2 rounded border ml-1 opacity-75"
              style={{ borderColor: 'var(--ot-border)', color: 'var(--ot-amber)' }}
            >
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Ticker Tape Ribbon */}
      <div
        className="flex items-center overflow-x-auto py-1 px-4 text-xs font-mono border-t no-scrollbar"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-root)',
        }}
      >
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2 text-slate-400 font-semibold tracking-wider text-[11px]">
            <Activity className="w-3 h-3" style={{ color: 'var(--ot-amber)' }} />
            <span>GLOBAL FEEDS:</span>
          </div>

          {[
            { s: 'XAU/USD', p: '4,043.50', c: '+3.24%' },
            { s: 'SPY', p: '584.20', c: '+0.53%' },
            { s: 'QQQ', p: '495.60', c: '+0.99%' },
            { s: 'BTC', p: '78,456', c: '+1.89%' },
            { s: 'NVDA', p: '206.69', c: '-11.65%' },
            { s: 'AAPL', p: '232.10', c: '+0.50%' },
            { s: 'ETH', p: '2,322', c: '+2.40%' },
            { s: 'SOL', p: '93.19', c: '+0.97%' },
            { s: 'US10Y', p: '4.95%', c: '+0.03' },
            { s: 'VIX', p: '18.40', c: '-2.38%' },
          ].map((item) => {
            const isPos = !item.c.startsWith('-');
            return (
              <div key={item.s} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-bold" style={{ color: 'var(--ot-text-secondary)' }}>
                  {item.s}
                </span>
                <span style={{ color: 'var(--ot-text-primary)' }}>{item.p}</span>
                <span
                  className="text-[11px]"
                  style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                >
                  {item.c}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
};
