import React, { useState, useEffect, useRef } from 'react';
import { useTerminal } from '../context/TerminalContext';
import { INITIAL_QUOTES } from '../services/marketData';
import { Search, Terminal, TrendingUp, Sparkles, X } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveSymbol,
    executeTerminalCommand,
    setTheme,
    setLayout,
  } = useTerminal();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const quoteEntries = Object.values(INITIAL_QUOTES);

  const matchedSymbols = quoteEntries.filter(
    (q) =>
      q.symbol.toLowerCase().includes(query.toLowerCase()) ||
      q.name.toLowerCase().includes(query.toLowerCase())
  );

  const commandActions = [
    { label: 'xau', desc: 'Open XAU/USD Bullion Gold Desk', action: () => executeTerminalCommand('xau') },
    { label: 'quote XAU/USD', desc: 'Focus Gold Spot quotes & LBMA depth', action: () => executeTerminalCommand('quote XAU/USD') },
    { label: 'chart XAU/USD 15m', desc: 'Load 15m Gold candlestick chart with Fibonacci', action: () => executeTerminalCommand('chart XAU/USD 15m') },
    { label: 'fib on', desc: 'Enable Auto-Fibonacci Retracements & Extensions', action: () => executeTerminalCommand('fib on') },
    { label: 'pivots classic', desc: 'Plot Classic Floor Trader Pivot Points', action: () => executeTerminalCommand('pivots classic') },
    { label: 'pivots camarilla', desc: 'Plot Camarilla Institutional Pivot Points', action: () => executeTerminalCommand('pivots camarilla') },
    { label: 'ind vwap', desc: 'Toggle Session VWAP line on active chart', action: () => executeTerminalCommand('ind vwap') },
    { label: 'ind rsi', desc: 'Toggle RSI (14) oscillator sub-pane', action: () => executeTerminalCommand('ind rsi') },
    { label: 'ind atr', desc: 'Toggle ATR (14) gold pip volatility sub-pane', action: () => executeTerminalCommand('ind atr') },
    { label: 'quote NVDA', desc: 'Focus NVIDIA equity quotes', action: () => executeTerminalCommand('quote NVDA') },
    { label: 'quote BTC', desc: 'Focus Bitcoin spot quotes', action: () => executeTerminalCommand('quote BTC') },
    { label: 'theme hybrid', desc: 'Apply Hybrid Pro fusion aesthetic', action: () => setTheme('hybrid') },
    { label: 'theme bloomberg', desc: 'Apply Bloomberg Amber & Emerald theme', action: () => setTheme('bloomberg') },
    { label: 'theme retro', desc: 'Apply Retro Green Phosphor CRT theme', action: () => setTheme('retro') },
    { label: 'scanlines on', desc: 'Enable CRT phosphor scanline overlay', action: () => executeTerminalCommand('scanlines on') },
    { label: 'layout xauusd', desc: 'Focus Bullion Gold Terminal Layout', action: () => setLayout('xauusd') },
    { label: 'layout default', desc: 'Reset to standard multi-panel workspace', action: () => setLayout('default') },
    { label: 'layout trading', desc: 'Focus equity desk & chart analysis', action: () => setLayout('trading') },
    { label: 'layout crypto', desc: 'Focus cryptocurrency spot board', action: () => setLayout('crypto') },
  ].filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.desc.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectSymbol = (sym: string) => {
    setActiveSymbol(sym);
    setIsCommandPaletteOpen(false);
  };

  const handleRunCommand = (action: () => void) => {
    action();
    setIsCommandPaletteOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-xl rounded-lg border shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--ot-bg-surface)',
          borderColor: 'var(--ot-border)',
        }}
      >
        {/* Search Input Bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--ot-border)' }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ot-cyan)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker (AAPL, BTC) or type a command (theme, layout)..."
            className="flex-1 bg-transparent text-sm font-mono outline-none text-slate-100 placeholder:text-slate-500"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3 font-mono text-xs">
          {/* Matched Securities */}
          {matchedSymbols.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 tracking-wider">
                SECURITIES & ASSETS
              </div>
              {matchedSymbols.map((s) => (
                <div
                  key={s.symbol}
                  onClick={() => handleSelectSymbol(s.symbol)}
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100" style={{ color: 'var(--ot-amber)' }}>
                      {s.symbol}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-300">{s.name}</span>
                  </div>
                  <div className="tabular-nums font-semibold" style={{ color: 'var(--ot-text-primary)' }}>
                    ${s.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Matched Commands */}
          {commandActions.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 tracking-wider">
                TERMINAL ACTIONS
              </div>
              {commandActions.map((cmd) => (
                <div
                  key={cmd.label}
                  onClick={() => handleRunCommand(cmd.action)}
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--ot-cyan)' }} />
                    <span className="font-semibold text-slate-100">{cmd.label}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{cmd.desc}</span>
                </div>
              ))}
            </div>
          )}

          {matchedSymbols.length === 0 && commandActions.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              No matching assets or terminal commands found for "{query}".
            </div>
          )}
        </div>

        {/* Footer Shortcut Guide */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t text-[11px] font-mono text-slate-400"
          style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-panel)' }}
        >
          <span>Navigate: ↑ / ↓</span>
          <span>Execute: Enter</span>
          <span>Dismiss: Esc</span>
        </div>
      </div>
    </div>
  );
};
