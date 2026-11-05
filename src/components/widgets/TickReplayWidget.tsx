import React, { useState, useEffect } from 'react';
import {
  tickReplayEngine,
} from '../../services/tickReplayEngine';
import { ReplayState, ReplayTick, TickReplayStats } from '../../types/terminal';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Clock,
  Zap,
  Activity,
  Disc,
  RotateCcw,
  Sliders,
  ShieldAlert,
} from 'lucide-react';

export const TickReplayWidget: React.FC = () => {
  const [state, setState] = useState<ReplayState>(tickReplayEngine.getState());
  const [currentTick, setCurrentTick] = useState<ReplayTick | null>(tickReplayEngine.getCurrentTick());
  const [stats, setStats] = useState<TickReplayStats>(tickReplayEngine.getStats());

  useEffect(() => {
    const unsub = tickReplayEngine.subscribe((tick, s) => {
      setCurrentTick(tick);
      setStats(s);
      setState(tickReplayEngine.getState());
    });
    return unsub;
  }, []);

  const handlePlay = () => tickReplayEngine.play();
  const handlePause = () => tickReplayEngine.pause();
  const handleStop = () => tickReplayEngine.stop();
  const handleStepFwd = () => tickReplayEngine.stepForward();
  const handleStepBack = () => tickReplayEngine.stepBackward();
  const handleSpeed = (speed: 1 | 2 | 5 | 10) => tickReplayEngine.setSpeed(speed);
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    tickReplayEngine.seekToIndex(idx);
  };

  const progressPct = stats.totalRecorded > 1
    ? ((stats.currentReplayIndex / (stats.totalRecorded - 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold tracking-wider text-[var(--text-color)] uppercase">
            HFT Tick Replay & Back-Simulation Engine
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              state === 'PLAYING'
                ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)] animate-pulse'
                : state === 'RECORDING'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'
            }`}
          >
            {state}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Disc className="w-3.5 h-3.5 text-blue-400" />
            Buffer: {stats.totalRecorded} ticks
          </span>
          <button
            onClick={() => tickReplayEngine.clearBuffer()}
            title="Reset Buffer"
            className="p-1 hover:text-[var(--text-color)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Telemetry & Playback Controls */}
      <div className="p-3 border-b border-[var(--border-color)] bg-[var(--surface-color)] flex flex-col gap-3">
        {/* Playback Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {state === 'PLAYING' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded font-bold transition-all"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE</span>
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-emerald)]/20 hover:bg-[var(--accent-emerald)]/30 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/40 rounded font-bold transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </button>
            )}

            <button
              onClick={handleStop}
              className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] rounded text-[var(--text-muted)] hover:text-[var(--text-color)]"
              title="Stop & Reset"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStepBack}
              className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] rounded text-[var(--text-muted)] hover:text-[var(--text-color)]"
              title="Step Backward (1 Tick)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStepFwd}
              className="p-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] rounded text-[var(--text-muted)] hover:text-[var(--text-color)]"
              title="Step Forward (1 Tick)"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-[var(--surface-elevated)] p-1 rounded border border-[var(--border-color)]">
            <span className="text-[10px] text-[var(--text-muted)] px-1">SPEED:</span>
            {([1, 2, 5, 10] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => handleSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  stats.playbackSpeed === spd
                    ? 'bg-[var(--accent-amber)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
            <span>Tick #{stats.currentReplayIndex + 1} of {stats.totalRecorded}</span>
            <span>{progressPct}% Completed</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, stats.totalRecorded - 1)}
            value={stats.currentReplayIndex}
            onChange={handleSeek}
            className="w-full accent-[var(--accent-amber)] cursor-pointer"
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <div className="p-2 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">REPLAY PRICE</span>
            <span className="text-base font-bold text-[var(--accent-emerald)]">
              ${currentTick ? currentTick.price.toFixed(2) : '---'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              Vol: {currentTick ? currentTick.volume.toFixed(2) : '---'} oz
            </span>
          </div>

          <div className="p-2 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">SIMULATED SLIPPAGE</span>
            <span className="text-base font-bold text-[var(--accent-cyan)]">
              {stats.slippageEstimatedBps.toFixed(1)} bps
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              Delta: ${(stats.slippageEstimatedBps * 0.0404).toFixed(3)}/oz
            </span>
          </div>

          <div className="p-2 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">ENGINE LATENCY</span>
            <span className="text-base font-bold text-[var(--accent-amber)] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {stats.simulatedLatencyUs} μs
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              Tick-to-Trade execution
            </span>
          </div>

          <div className="p-2 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">TICK TIMESTAMP</span>
            <span className="text-xs font-bold text-[var(--text-color)] mt-0.5">
              {currentTick ? new Date(currentTick.timestamp).toLocaleTimeString() : '---'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              {currentTick?.source || 'ORACLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Preset Sessions & Flash-Crash Scenarios */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-color)] mb-2">
          <Sliders className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
          <span>INSTITUTIONAL SESSION REPLAY SCENARIOS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div
            onClick={() => tickReplayEngine.seekToIndex(0)}
            className="p-2.5 bg-[var(--surface-elevated)] hover:border-[var(--accent-amber)] border border-[var(--border-color)] rounded cursor-pointer transition-all flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--accent-amber)] text-xs">US CPI INFLATION SPIKE</span>
              <span className="text-[10px] text-emerald-400 font-mono">+1.2% Surge</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Replay 60 real ticks of rapid price acceleration and liquidity thinning.
            </p>
          </div>

          <div
            onClick={() => tickReplayEngine.seekToIndex(Math.floor(stats.totalRecorded * 0.4))}
            className="p-2.5 bg-[var(--surface-elevated)] hover:border-[var(--accent-cyan)] border border-[var(--border-color)] rounded cursor-pointer transition-all flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--accent-cyan)] text-xs">LONDON OPEN BREAKOUT</span>
              <span className="text-[10px] text-blue-400 font-mono">Volume Surge</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Session overlap liquidity sweep across 08:00 UTC institutional desk open.
            </p>
          </div>

          <div
            onClick={() => tickReplayEngine.seekToIndex(Math.floor(stats.totalRecorded * 0.75))}
            className="p-2.5 bg-[var(--surface-elevated)] hover:border-red-500 border border-[var(--border-color)] rounded cursor-pointer transition-all flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-red-400 text-xs">COMEX LIQUIDITY SWEEP</span>
              <span className="text-[10px] text-red-400 font-mono">-0.8% Drop</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Flash stop-loss cascade with bid-ask spread blowout testing slippage guardrails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
