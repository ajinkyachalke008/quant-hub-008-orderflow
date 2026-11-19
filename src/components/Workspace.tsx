import React, { useState, useEffect } from 'react';
import { useTerminal } from '../context/TerminalContext';
import { ChartWidget } from './widgets/ChartWidget';
import { MtfWorkspaceGrid } from './widgets/MtfWorkspaceGrid';
import { QuoteWidget } from './widgets/QuoteWidget';
import { WatchlistWidget } from './widgets/WatchlistWidget';
import { NewsWidget } from './widgets/NewsWidget';
import { MacroWidget } from './widgets/MacroWidget';
import { CryptoWidget } from './widgets/CryptoWidget';
import { ScreenerWidget } from './widgets/ScreenerWidget';
import { HeatmapWidget } from './widgets/HeatmapWidget';
import { CliWidget } from './widgets/CliWidget';
import { GoldTelemetryWidget } from './widgets/GoldTelemetryWidget';
import { GoldOrderBookWidget } from './widgets/GoldOrderBookWidget';
import { CryptoTicker } from './widgets/CryptoTicker';
import { PaperTradingWidget } from './widgets/PaperTradingWidget';
import { PositionSizeCalculatorWidget } from './widgets/PositionSizeCalculatorWidget';
import { MacroCorrelationWidget } from './widgets/MacroCorrelationWidget';
import { AlertsManagerWidget } from './widgets/AlertsManagerWidget';
// Phase II Modules
import { BacktestAnalyticsWidget } from './widgets/BacktestAnalyticsWidget';
import { PineScriptWidget } from './widgets/PineScriptWidget';
import { AccountManagerWidget } from './widgets/AccountManagerWidget';
import { WebhookManagerWidget } from './widgets/WebhookManagerWidget';
// Phase III Modules
import { Level2OrderBookWidget } from './widgets/Level2OrderBookWidget';
import { AlgoTradingBotWidget } from './widgets/AlgoTradingBotWidget';
import { MacroCalendarWidget } from './widgets/MacroCalendarWidget';
import { FixAuditTrailWidget } from './widgets/FixAuditTrailWidget';
import { LayoutPresetManagerWidget } from './widgets/LayoutPresetManagerWidget';
// Phase V Sovereign & Ultra-Low-Latency Institutional Modules
import { TickReplayWidget } from './widgets/TickReplayWidget';
import { WasmMatchingEngineWidget } from './widgets/WasmMatchingEngineWidget';
import { PortfolioRiskWidget } from './widgets/PortfolioRiskWidget';
import { FixSessionManager } from './widgets/FixSessionManager';
import { SubAccountRiskWidget } from './widgets/SubAccountRiskWidget';
import { OrderFlowTerminalWidget } from './widgets/OrderFlowTerminalWidget';

import { layoutManagerService } from '../services/layoutManagerService';
import { algoTradingEngine } from '../services/algoTradingEngine';
import { FloatingPaneState } from '../types/terminal';

import {
  Activity,
  Code2,
  Wallet,
  MessageSquare,
  LayoutGrid,
  Layers,
  Cpu,
  Calendar,
  FileText,
  Monitor,
  X,
  FastForward,
  ShieldAlert,
} from 'lucide-react';

export const Workspace: React.FC = () => {
  const { layout, widgets, activeQuote, activeSymbol } = useTerminal();
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    | 'grid'
    | 'l2book'
    | 'algobots'
    | 'calendar'
    | 'backtest'
    | 'pine'
    | 'vaults'
    | 'fix'
    | 'webhooks'
    | 'presets'
    | 'tickreplay'
    | 'wasmmatching'
    | 'varrisk'
    | 'fixsession'
    | 'subaccount'
    | 'orderflow'
  >('grid');

  const [floatingPanes, setFloatingPanes] = useState<FloatingPaneState[]>(() => layoutManagerService.getFloatingPanes());

  useEffect(() => {
    const unsub = layoutManagerService.subscribe((_, f) => setFloatingPanes(f));
    return unsub;
  }, []);

  // Hook live market ticks into Algo Bot execution engine
  useEffect(() => {
    if (activeQuote?.price && activeQuote.price > 0) {
      algoTradingEngine.onTick(
        activeSymbol,
        activeQuote.price,
        activeQuote.high && activeQuote.low ? (activeQuote.high + activeQuote.low + activeQuote.price) / 3 : undefined,
        activeQuote.spread ? activeQuote.spread * 4 : 4.5,
        activeQuote.fiftyTwoWeekHigh,
        activeQuote.fiftyTwoWeekLow,
        parseFloat(activeQuote.volume?.replace(/[^0-9.]/g, '') || '100'),
        100
      );
    }
  }, [activeQuote?.price, activeSymbol]);

  const isVisible = (id: string) => {
    const w = widgets.find((item) => item.id === id);
    return w ? w.visible : true;
  };

  const renderWidgetById = (id: string) => {
    switch (id) {
      case 'level2-book':
        return <Level2OrderBookWidget />;
      case 'paper-trading':
        return <PaperTradingWidget />;
      case 'fix-inspector':
        return <FixAuditTrailWidget />;
      case 'macro-calendar':
        return <MacroCalendarWidget />;
      case 'algo-bots':
        return <AlgoTradingBotWidget />;
      case 'tick-replay':
        return <TickReplayWidget />;
      case 'wasm-matching':
        return <WasmMatchingEngineWidget />;
      case 'portfolio-var':
        return <PortfolioRiskWidget />;
      case 'fix-session':
        return <FixSessionManager />;
      case 'subaccount-risk':
        return <SubAccountRiskWidget />;
      default:
        return <GoldOrderBookWidget />;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-color)] text-[var(--text-color)] overflow-hidden relative">
      {/* Secondary Institutional Navigation Ribbon */}
      <div className="px-3 py-1.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between text-xs font-mono select-none overflow-x-auto">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveWorkspaceTab('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'grid'
                ? 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] font-bold border border-[var(--accent-amber)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>TERMINAL DESK</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('l2book')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'l2book'
                ? 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] font-bold border border-[var(--accent-amber)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>L2 DEPTH & TAPE</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('tickreplay')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'tickreplay'
                ? 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] font-bold border border-[var(--accent-amber)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>TICK REPLAY</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('wasmmatching')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'wasmmatching'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>WASM MATCHING</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('varrisk')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'varrisk'
                ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>PORTFOLIO VaR</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('fixsession')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'fixsession'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>FIX SESSION HUB</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('subaccount')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'subaccount'
                ? 'bg-purple-500/20 text-purple-400 font-bold border border-purple-500/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>DESK RISK MATRIX</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('algobots')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'algobots'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ALGO BOTS</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'calendar'
                ? 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] font-bold border border-[var(--accent-amber)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>MACRO CALENDAR</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('backtest')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'backtest'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>BACKTESTER</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('pine')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'pine'
                ? 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] font-bold border border-[var(--accent-amber)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>PINE STUDIO</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('vaults')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'vaults'
                ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] font-bold border border-[var(--accent-emerald)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>VAULTS</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('fix')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'fix'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>FIX AUDIT</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('webhooks')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'webhooks'
                ? 'bg-purple-400/20 text-purple-400 font-bold border border-purple-400/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WEBHOOKS</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('presets')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'presets'
                ? 'bg-blue-400/20 text-blue-400 font-bold border border-blue-400/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PRESETS</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('orderflow')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all text-[11px] ${
              activeWorkspaceTab === 'orderflow'
                ? 'bg-[var(--ot-accent)]/20 text-[var(--ot-accent)] font-bold border border-[var(--ot-accent)]/50'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>ORDER FLOW</span>
          </button>
        </div>
      </div>

      {/* View Switcher Panels */}
      {activeWorkspaceTab === 'tickreplay' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <TickReplayWidget />
        </div>
      )}

      {activeWorkspaceTab === 'wasmmatching' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <WasmMatchingEngineWidget />
        </div>
      )}

      {activeWorkspaceTab === 'varrisk' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <PortfolioRiskWidget />
        </div>
      )}

      {activeWorkspaceTab === 'fixsession' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <FixSessionManager />
        </div>
      )}

      {activeWorkspaceTab === 'subaccount' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <SubAccountRiskWidget />
        </div>
      )}

      {activeWorkspaceTab === 'algobots' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <AlgoTradingBotWidget />
        </div>
      )}

      {activeWorkspaceTab === 'calendar' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <MacroCalendarWidget />
        </div>
      )}

      {activeWorkspaceTab === 'fix' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <FixAuditTrailWidget />
        </div>
      )}

      {activeWorkspaceTab === 'presets' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <LayoutPresetManagerWidget />
        </div>
      )}

      {activeWorkspaceTab === 'backtest' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <BacktestAnalyticsWidget />
        </div>
      )}

      {activeWorkspaceTab === 'pine' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <PineScriptWidget />
        </div>
      )}

      {activeWorkspaceTab === 'vaults' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <AccountManagerWidget />
        </div>
      )}

      {activeWorkspaceTab === 'webhooks' && (
        <div className="flex-1 p-3 overflow-hidden min-h-0">
          <WebhookManagerWidget />
        </div>
      )}

      {/* Main Multi-Tier Grid */}
      {activeWorkspaceTab === 'grid' && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0 relative">
          {/* Tier 1: Multi-Timeframe Dual-Pane Chart Suite + Live Telemetry */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-9 min-h-[500px]">
              <MtfWorkspaceGrid />
            </div>
            <div className="col-span-12 xl:col-span-3 flex flex-col gap-3 min-h-[500px]">
              <GoldTelemetryWidget />
              <AlertsManagerWidget />
            </div>
          </div>

          {/* Tier 2: Level 2 Depth & Liquidity Wall + Time & Sales Tape */}
          <div className="min-h-[420px]">
            <Level2OrderBookWidget />
          </div>

          {/* Tier 3: Live Institutional Paper Execution Desk + Position Risk Calculator */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-7 min-h-[420px]">
              <PaperTradingWidget />
            </div>
            <div className="col-span-12 xl:col-span-5 min-h-[420px]">
              <PositionSizeCalculatorWidget />
            </div>
          </div>

          {/* Tier 4: Algorithmic Trading Bots & Execution Engine */}
          <div className="min-h-[420px]">
            <AlgoTradingBotWidget />
          </div>

          {/* Tier 5: Economic Calendar Countdown & NLP News Sentiment Wire */}
          <div className="min-h-[380px]">
            <MacroCalendarWidget />
          </div>

          {/* Tier 6: Strategy Backtester & Performance Analytics */}
          <div className="min-h-[450px]">
            <BacktestAnalyticsWidget />
          </div>

          {/* Tier 7: FIX 4.4 Protocol Simulator & Compliance Audit Log */}
          <div className="min-h-[400px]">
            <FixAuditTrailWidget />
          </div>

          {/* Tier 8: Multi-Account Portfolio Vaults & Pine Script Studio Split */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-6 min-h-[420px]">
              <AccountManagerWidget />
            </div>
            <div className="col-span-12 xl:col-span-6 min-h-[420px]">
              <PineScriptWidget />
            </div>
          </div>

          {/* Tier 9: Macro Correlation Matrix & Webhook Dispatcher */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-6 min-h-[380px]">
              <MacroCorrelationWidget />
            </div>
            <div className="col-span-12 xl:col-span-6 min-h-[380px]">
              <WebhookManagerWidget />
            </div>
          </div>

          {/* Tier 10: Terminal CLI Command Console */}
          {isVisible('cli') && (
            <div className="h-64">
              <CliWidget />
            </div>
          )}

          {/* Crypto Ticker Ribbon */}
          {isVisible('crypto-ticker') && <CryptoTicker />}
        </div>
      )}

      {/* Floating In-App Panes Overlay (Multi-Monitor Glassmorphism Windows) */}
      {floatingPanes
        .filter((pane) => pane.isOpen)
        .map((pane) => (
          <div
            key={pane.id}
            className="fixed z-50 rounded-lg border shadow-2xl overflow-hidden flex flex-col bg-[#07090e]/95 backdrop-blur-md"
            style={{
              left: `${pane.x}px`,
              top: `${pane.y}px`,
              width: `${pane.width}px`,
              height: `${pane.height}px`,
              borderColor: 'var(--ot-border)',
            }}
          >
            {/* Window Drag Header */}
            <div className="px-3 py-1.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-1.5 font-bold text-[var(--accent-amber)]">
                <Monitor className="w-3.5 h-3.5" />
                <span>{pane.title}</span>
              </div>
              <button
                onClick={() => layoutManagerService.closeFloatingPane(pane.id)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              {renderWidgetById(pane.widgetId)}
            </div>
          </div>
        ))}
    </div>
  );
};





