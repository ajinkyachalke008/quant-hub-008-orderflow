import React, { useState, useEffect } from 'react';
import {
  Monitor,
  ExternalLink,
  Layers,
  LayoutGrid,
  Maximize2,
  Check,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { layoutManagerService } from '../../services/layoutManagerService';
import { FloatingPaneState, WidgetId, WorkspacePreset } from '../../types/terminal';

export const LayoutPresetManagerWidget: React.FC = () => {
  const [activePreset, setActivePreset] = useState<WorkspacePreset>(() => layoutManagerService.getActivePreset());
  const [floatingPanes, setFloatingPanes] = useState<FloatingPaneState[]>(() => layoutManagerService.getFloatingPanes());
  const [copiedStatus, setCopiedStatus] = useState<string>('');

  useEffect(() => {
    const unsub = layoutManagerService.subscribe((p, f) => {
      setActivePreset(p);
      setFloatingPanes(f);
    });
    return unsub;
  }, []);

  const handleSelectPreset = (p: WorkspacePreset) => {
    layoutManagerService.setPreset(p);
  };

  const handleLaunchFloating = (widgetId: WidgetId, title: string) => {
    layoutManagerService.openFloatingPane(widgetId, title);
    setCopiedStatus(`Docked: ${title}`);
    setTimeout(() => setCopiedStatus(''), 2500);
  };

  const handlePopout = (id: string) => {
    layoutManagerService.popoutWindow(id);
  };

  const presets: { id: WorkspacePreset; title: string; desc: string; icon: string }[] = [
    {
      id: 'default_scalper',
      title: 'Institutional Scalper',
      desc: 'Synchronized Dual-Timeframe Chart (15m + 1h), L2 Depth, Tape, and 1:50 Margin Execution Desk.',
      icon: '⚡',
    },
    {
      id: 'macro_swing',
      title: 'Macro Bullion Swing',
      desc: 'Economic Calendar Countdown, Gold-to-Silver Ratio (GSR), Yields, and NLP News Sentiment.',
      icon: '🌐',
    },
    {
      id: 'algo_quant',
      title: 'Algorithmic Quant Desk',
      desc: 'Web-Worker Algo Bots, Strategy Backtester, and Custom Pine Script Studio.',
      icon: '🤖',
    },
    {
      id: 'hft_depth',
      title: 'High-Frequency Depth & Tape',
      desc: 'Aggregated 20-level Level 2 Order Book, Cumulative Depth Chart, and Sweep Tape.',
      icon: '📊',
    },
    {
      id: 'full_desk',
      title: 'Full Institutional Multi-Grid',
      desc: 'Comprehensive multi-panel layout with all trading, analytics, telemetry, and FIX compliance modules.',
      icon: '🖥️',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-amber)]">
            Multi-Monitor Workspace Presets
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Independent Floating Windows
          </span>
        </div>

        {copiedStatus && (
          <span className="text-[10px] text-[var(--accent-emerald)] font-bold animate-pulse">
            {copiedStatus}
          </span>
        )}
      </div>

      {/* Main Split: Presets Selector + Popout Windows Control */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left 7 cols: Presets Grid */}
        <div className="md:col-span-7 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-y-auto space-y-2">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block pb-1 border-b border-[var(--border-color)]">
            Institutional Workspace Presets
          </span>

          {presets.map((p) => {
            const isSelected = activePreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`p-2.5 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--accent-amber)]/15 border-[var(--accent-amber)] shadow-[0_0_10px_rgba(255,176,0,0.15)]'
                    : 'bg-[var(--surface-color)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.icon}</span>
                    <strong className="text-xs text-[var(--text-color)]">{p.title}</strong>
                  </div>
                  {isSelected && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[var(--accent-amber)] text-black">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed pl-6">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Right 5 cols: Detachable Panes Manager */}
        <div className="md:col-span-5 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-y-auto space-y-2.5">
          <span className="text-[10px] uppercase font-bold text-[var(--accent-cyan)] tracking-wider block pb-1 border-b border-[var(--border-color)]">
            Detachable Multi-Monitor Windows
          </span>
          <p className="text-[10px] text-[var(--text-muted)]">
            Pop out individual trading panels to position on secondary display monitors or arrange as floating institutional widgets.
          </p>

          <div className="space-y-1.5">
            <button
              onClick={() => handleLaunchFloating('level2-book', 'Level 2 Depth & Liquidity')}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] hover:border-[var(--accent-cyan)] transition-all text-[11px]"
            >
              <span>Level 2 Depth & Liquidity Wall</span>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
            </button>

            <button
              onClick={() => handleLaunchFloating('paper-trading', 'Institutional Execution Desk')}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] hover:border-[var(--accent-emerald)] transition-all text-[11px]"
            >
              <span>Paper Execution & Order Matrix</span>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-emerald)]" />
            </button>

            <button
              onClick={() => handleLaunchFloating('fix-inspector', 'FIX 4.4 Protocol Inspector')}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] hover:border-[var(--accent-amber)] transition-all text-[11px]"
            >
              <span>FIX 4.4 Protocol Audit Log</span>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
            </button>

            <button
              onClick={() => handleLaunchFloating('macro-calendar', 'Macroeconomic Calendar & Sentiment')}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] hover:border-purple-400 transition-all text-[11px]"
            >
              <span>Economic Calendar & News Wire</span>
              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
