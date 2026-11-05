import React, { useState, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { alertEngine } from '../../services/alertEngine';
import { audioAlertService } from '../../services/audioAlertService';
import { PriceAlert } from '../../types/terminal';
import { Bell, Volume2, VolumeX, Trash2, Check, Music } from 'lucide-react';

export const AlertsManagerWidget: React.FC = () => {
  const { activeQuote, activeSymbol } = useTerminal();
  const currentPrice = activeQuote?.price || 4040.0;

  const [alerts, setAlerts] = useState<PriceAlert[]>(alertEngine.getAlerts());
  const [targetPrice, setTargetPrice] = useState<number>(Number((currentPrice + 10).toFixed(2)));
  const [note, setNote] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(audioAlertService.isMuted());

  useEffect(() => {
    const unsub = alertEngine.subscribe((list) => {
      setAlerts([...list]);
    });
    return unsub;
  }, []);

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice || targetPrice <= 0) return;
    alertEngine.addAlert(activeSymbol, targetPrice, note);
    setNote('');
  };

  const handleToggleMute = () => {
    const next = audioAlertService.toggleMute();
    setIsMuted(next);
  };

  const handleTestChime = () => {
    audioAlertService.playBloombergChime();
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md flex flex-col h-full overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--accent)]">PRICE & AUDIO ALERTS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestChime}
            title="Test Bloomberg Dual-Tone Chime"
            className="flex items-center gap-1 px-2 py-0.5 bg-[var(--surface)] hover:bg-[var(--border)] text-[10px] text-[var(--text-secondary)] rounded transition-colors"
          >
            <Music className="w-3 h-3 text-[var(--accent)]" />
            <span>Test Chime</span>
          </button>
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Terminal Audio' : 'Mute Terminal Audio'}
            className={`p-1 rounded transition-colors ${
              isMuted ? 'text-rose-400 bg-rose-950/40' : 'text-emerald-400 bg-emerald-950/40'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        {/* Create Alert Form */}
        <form onSubmit={handleAddAlert} className="p-2.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">SET NEW CROSSING ALERT</span>
            <span className="text-[10px] text-[var(--text-secondary)]">SPOT: ${currentPrice.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] block mb-1">TARGET PRICE ($)</label>
              <input
                type="number"
                step="0.1"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-[var(--text-muted)] block mb-1">NOTE / LABEL</label>
              <input
                type="text"
                placeholder="e.g. Resistance breakout, Asian high sweep"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-1.5 bg-[var(--accent)] hover:opacity-90 text-black font-semibold rounded transition-opacity"
          >
            ARM AUDIO ALERT
          </button>
        </form>

        {/* Alerts List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>ACTIVE ALERTS ({alerts.length})</span>
            {alerts.length > 0 && (
              <button
                onClick={() => alertEngine.clearAll()}
                className="text-rose-400 hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)] text-[11px]">
              No alerts armed. Set a target price above.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`p-2 rounded border flex items-center justify-between ${
                  a.triggered
                    ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                    : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-primary)]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <strong className="text-[var(--accent)]">{a.symbol}</strong>
                    <span className="text-[10px] uppercase text-[var(--text-secondary)]">
                      {a.condition.replace('_', ' ')}
                    </span>
                    <strong className="text-[var(--text-primary)] font-bold">${a.targetPrice.toFixed(2)}</strong>
                    {a.triggered && (
                      <span className="flex items-center gap-0.5 text-[10px] bg-emerald-900/60 text-emerald-200 px-1 py-0.2 rounded">
                        <Check className="w-2.5 h-2.5" /> TRIGGERED
                      </span>
                    )}
                  </div>
                  {a.note && <div className="text-[10px] text-[var(--text-muted)]">{a.note}</div>}
                </div>

                <button
                  onClick={() => alertEngine.removeAlert(a.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
