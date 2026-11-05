import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  Pause,
  AlertOctagon,
  RotateCcw,
  Shield,
  Activity,
  Terminal,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { algoTradingEngine } from '../../services/algoTradingEngine';
import { AlgoBotConfig, AlgoBotLog, AlgoBotTelemetry } from '../../types/terminal';

export const AlgoTradingBotWidget: React.FC = () => {
  const [bots, setBots] = useState<AlgoBotConfig[]>([]);
  const [logs, setLogs] = useState<AlgoBotLog[]>([]);
  const [telemetry, setTelemetry] = useState<AlgoBotTelemetry>(() => algoTradingEngine.getTelemetry());

  useEffect(() => {
    const unsub = algoTradingEngine.subscribe((b, l, t) => {
      setBots(b);
      setLogs(l);
      setTelemetry(t);
    });
    return unsub;
  }, []);

  const handleToggle = (id: string) => {
    algoTradingEngine.toggleBot(id);
  };

  const handleKillSwitch = () => {
    if (confirm('ENGAGE EMERGENCY KILL SWITCH? This will immediately halt all quantitative bots and liquidate all active positions.')) {
      algoTradingEngine.emergencyKillSwitch();
    }
  };

  const handleResume = () => {
    algoTradingEngine.resumeOperations();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--accent-cyan)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-cyan)]">
            Algorithmic Trading Bot Engine
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              telemetry.status === 'ACTIVE'
                ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/40'
                : telemetry.status === 'HALTED'
                ? 'bg-[#FF1744]/20 text-[#FF1744] border border-[#FF1744]/40 animate-pulse'
                : 'bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]'
            }`}
          >
            ● {telemetry.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {telemetry.status === 'HALTED' ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-emerald)] text-black font-bold text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESUME BOTS</span>
            </button>
          ) : (
            <button
              onClick={handleKillSwitch}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#FF1744] hover:bg-[#d50000] text-white font-bold text-xs transition-all shadow-md"
              title="Emergency Kill Switch"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>KILL SWITCH</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Telemetry Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-[var(--surface-color)] border-b border-[var(--border-color)]">
        <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Bot Realized PnL</span>
          <span className={`text-sm font-bold ${telemetry.realizedPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
            {telemetry.realizedPnl >= 0 ? '+' : ''}${telemetry.realizedPnl.toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Bot Win Rate</span>
          <span className="text-sm font-bold text-[var(--accent-amber)]">
            {telemetry.winRate}% ({telemetry.winningTrades}/{telemetry.totalTrades})
          </span>
        </div>

        <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Active Positions</span>
          <span className="text-sm font-bold text-[var(--accent-cyan)]">{telemetry.activePositionsCount} Open</span>
        </div>

        <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)]">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Execution Mode</span>
          <span className="text-xs font-bold text-[var(--text-color)]">Web-Worker Sandbox</span>
        </div>
      </div>

      {/* Main Split: Strategy Cards & Live Event Log */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left Column: Active Algo Bot Cards */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-y-auto space-y-2.5">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block pb-1 border-b border-[var(--border-color)]">
            Quantitative Strategy Presets ({bots.length})
          </span>

          {bots.map((bot) => (
            <div
              key={bot.id}
              className={`p-3 rounded border transition-all ${
                bot.enabled
                  ? 'bg-[var(--accent-cyan)]/10 border-[var(--accent-cyan)]/60'
                  : 'bg-[var(--surface-color)] border-[var(--border-color)] opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[var(--text-color)]">{bot.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--accent-amber)] font-bold">
                    {bot.symbol}
                  </span>
                </div>

                <button
                  onClick={() => handleToggle(bot.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                    bot.enabled
                      ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/50'
                      : 'bg-[var(--border-color)] text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  {bot.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{bot.enabled ? 'ACTIVE' : 'PAUSED'}</span>
                </button>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] mb-2">
                {bot.strategy === 'vwap_reversion'
                  ? 'Trades statistical mean-reversions when price deviates beyond 1.5 standard deviations from Session VWAP with dynamic ATR risk bounds.'
                  : 'Trades institutional liquidity sweeps & momentum continuation when price breaches Previous Day High (PDH) or Low (PDL) with volume confirmation.'}
              </p>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-[var(--surface-color)] p-1.5 rounded border border-[var(--border-color)]">
                <div>
                  <span className="text-[var(--text-muted)] block text-[9px]">Lot Size:</span>
                  <strong className="text-[var(--text-color)]">{bot.lotSize} Lots</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[9px]">Max Positions:</span>
                  <strong className="text-[var(--text-color)]">{bot.maxPositions}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[9px]">Stop Loss:</span>
                  <strong className="text-[#FF5252]">${bot.stopLossDollars || 8.0}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Real-Time Execution Console */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
            <span className="uppercase font-bold text-[var(--accent-amber)] tracking-wider">
              Strategy Decision & Execution Log
            </span>
            <span>{logs.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                          log.action === 'ENTRY'
                            ? 'bg-[var(--accent-emerald)] text-black'
                            : log.action === 'RISK_HALT'
                            ? 'bg-[#FF1744] text-white'
                            : 'bg-[var(--border-color)] text-[var(--text-muted)]'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-[var(--accent-cyan)] font-bold">{log.strategy}</span>
                    </div>
                    <span className="text-[var(--text-muted)]">{log.timestamp.slice(11, 19)} UTC</span>
                  </div>

                  <div className="text-[10px] text-[var(--text-color)] pl-1">{log.message}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                Algorithmic trading engine listening for high-probability signals...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
