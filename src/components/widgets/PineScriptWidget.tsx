import React, { useState, useEffect } from 'react';
import { Terminal, Play, Save, RotateCcw, AlertTriangle, CheckCircle, Code2, Layers } from 'lucide-react';
import { PineScriptEngine, DEFAULT_PINE_TEMPLATES } from '../../services/pineScriptEngine';
import { xauusdDataService } from '../../services/xauusdDataService';
import { CustomPineScript, PineScriptResult } from '../../types/terminal';

export const PineScriptWidget: React.FC = () => {
  const [scripts, setScripts] = useState<CustomPineScript[]>(() => PineScriptEngine.loadSavedScripts());
  const [activeScriptId, setActiveScriptId] = useState<string>(DEFAULT_PINE_TEMPLATES[0].id);
  const [code, setCode] = useState<string>(DEFAULT_PINE_TEMPLATES[0].code);
  const [scriptName, setScriptName] = useState<string>(DEFAULT_PINE_TEMPLATES[0].name);

  const [result, setResult] = useState<PineScriptResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const activeScript = scripts.find((s) => s.id === activeScriptId) || scripts[0];

  const handleSelectTemplate = (id: string) => {
    const sc = scripts.find((s) => s.id === id);
    if (sc) {
      setActiveScriptId(id);
      setCode(sc.code);
      setScriptName(sc.name);
    }
  };

  const handleExecute = () => {
    setIsExecuting(true);
    try {
      const candles = xauusdDataService.getCandles();
      const res = PineScriptEngine.execute(code, candles);
      setResult(res);
    } catch (e: any) {
      setResult({
        plots: [],
        hlines: [],
        errors: [e?.message || 'Execution error'],
        logs: [],
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSave = () => {
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 6) : performance.now().toFixed(0);
    const existingIdx = scripts.findIndex((s) => s.id === activeScriptId);
    let updated: CustomPineScript[];

    if (existingIdx !== -1 && !activeScriptId.startsWith('script_')) {
      updated = [...scripts];
      updated[existingIdx] = { ...updated[existingIdx], name: scriptName, code, lastRun: new Date().toISOString() };
    } else {
      const newScript: CustomPineScript = {
        id: `custom_${Date.now()}_${uid}`,
        name: scriptName || 'Custom Pine Indicator',
        code,
        lastRun: new Date().toISOString(),
      };
      updated = [newScript, ...scripts];
      setActiveScriptId(newScript.id);
    }

    setScripts(updated);
    PineScriptEngine.saveScripts(updated);
    setSaveStatus('SAVED TO LOCAL STORAGE');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  useEffect(() => {
    handleExecute();
  }, [activeScriptId]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header bar */}
      <div className="p-3 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-amber)]">
            Pine Script Engine
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Sandboxed Math & TA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && <span className="text-[10px] text-[var(--accent-emerald)] font-bold animate-pulse">{saveStatus}</span>}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-color)] hover:bg-[var(--surface-elevated)] text-[var(--text-color)] border border-[var(--border-color)] transition-all"
            title="Save Script to LocalStorage"
          >
            <Save className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
            <span>SAVE</span>
          </button>

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-amber)]/20 hover:bg-[var(--accent-amber)]/30 text-[var(--accent-amber)] border border-[var(--accent-amber)]/50 font-bold transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>EXECUTE</span>
          </button>
        </div>
      </div>

      {/* Script Selector Ribbon */}
      <div className="px-3 py-2 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <label className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider whitespace-nowrap">Template:</label>
          <select
            value={activeScriptId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="flex-1 max-w-xs bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none focus:border-[var(--accent-cyan)]"
          >
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <label className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider whitespace-nowrap">Name:</label>
          <input
            type="text"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            className="flex-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
          />
        </div>
      </div>

      {/* Code Editor and Output Split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden min-h-0">
        {/* Editor Area */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span className="uppercase font-bold tracking-wider text-[var(--accent-cyan)]">Source Editor</span>
            <span>ta.ema | ta.sma | ta.rsi | ta.atr | plot | hline</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 bg-[var(--surface-elevated)] text-[var(--accent-cyan)] font-mono text-xs leading-relaxed resize-none outline-none focus:ring-0"
          />
        </div>

        {/* Output Console & Computed Series */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded overflow-hidden">
          <div className="px-3 py-1.5 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span className="uppercase font-bold tracking-wider text-[var(--accent-amber)]">Telemetry & Series Outputs</span>
            <span>{result?.plots.length || 0} Plots Registered</span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono">
            {/* Syntax Errors */}
            {result?.errors && result.errors.length > 0 && (
              <div className="p-2.5 rounded bg-[#FF5252]/10 border border-[#FF5252]/40 text-[#FF5252] text-xs">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Compilation / Runtime Error</span>
                </div>
                {result.errors.map((err, i) => (
                  <div key={i} className="pl-5 text-[11px]">{err}</div>
                ))}
              </div>
            )}

            {/* Plots Computed Values */}
            {result?.plots && result.plots.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                  Computed Values (Latest Bar)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.plots.map((p, idx) => {
                    const lastVal = p.values[p.values.length - 1];
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-[var(--text-color)] font-medium">{p.title}</span>
                        </div>
                        <span className="font-bold text-xs" style={{ color: p.color }}>
                          {lastVal !== null && lastVal !== undefined ? lastVal : 'N/A'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Horizontal Lines */}
            {result?.hlines && result.hlines.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[var(--border-color)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                  Static Price Levels (Hlines)
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.hlines.map((h, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] border"
                      style={{ borderColor: h.color, color: h.color }}
                    >
                      {h.title}: {h.price}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Logs */}
            {result?.logs && result.logs.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[var(--border-color)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                  Interpreter Trace
                </span>
                <div className="text-[10px] text-[var(--text-muted)] space-y-0.5">
                  {result.logs.map((log, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-[var(--accent-emerald)] shrink-0" />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
