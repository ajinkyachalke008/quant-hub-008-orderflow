import React, { useState, useRef, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { Terminal as TerminalIcon, CornerDownLeft, Trash2 } from 'lucide-react';

export const CliWidget: React.FC = () => {
  const { commandLogs, executeTerminalCommand, clearCommandLogs } = useTerminal();
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commandLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      executeTerminalCommand(inputVal.trim());
      setInputVal('');
      setHistoryIndex(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!commandLogs.length) return;
      const nextIdx = historyIndex === null ? commandLogs.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(commandLogs[nextIdx].command);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandLogs.length) {
        setHistoryIndex(null);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(commandLogs[nextIdx].command);
      }
    }
  };

  const quickCommands = [
    'help',
    'quote NVDA',
    'chart BTC 1m',
    'theme retro',
    'theme hybrid',
    'macro',
    'scanlines',
    'status',
  ];

  return (
    <div
      className="flex flex-col h-full rounded border select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5" style={{ color: 'var(--ot-cyan)' }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            TERMINAL CLI
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">BASH / SHELL PIPE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearCommandLogs}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200"
            title="Clear terminal buffer"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">CLEAR</span>
          </button>
        </div>
      </div>

      {/* Terminal Log Output Buffer */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs cursor-text"
        style={{ backgroundColor: 'var(--ot-bg-root)' }}
      >
        {commandLogs.map((log) => {
          const color =
            log.status === 'success'
              ? 'var(--ot-profit)'
              : log.status === 'error'
              ? 'var(--ot-loss)'
              : 'var(--ot-cyan)';

          return (
            <div key={log.id} className="space-y-0.5">
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span style={{ color: 'var(--ot-amber)' }}>openterminal:~$</span>
                <span className="text-slate-200 font-semibold">{log.command}</span>
                <span className="text-slate-500 text-[10px]">[{log.timestamp}]</span>
              </div>
              {log.output && (
                <pre
                  className="whitespace-pre-wrap leading-relaxed text-[11px] pl-3 border-l-2"
                  style={{
                    color,
                    borderColor: 'var(--ot-border)',
                  }}
                >
                  {log.output}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested Quick Commands Bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto border-t text-[11px] font-mono no-scrollbar"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
        }}
      >
        <span className="text-slate-500 shrink-0">HINTS:</span>
        {quickCommands.map((qc) => (
          <button
            key={qc}
            onClick={() => executeTerminalCommand(qc)}
            className="px-2 py-0.5 rounded border whitespace-nowrap text-slate-300 hover:border-amber-400 transition-colors"
            style={{
              borderColor: 'var(--ot-border)',
              backgroundColor: 'var(--ot-bg-panel)',
            }}
          >
            {qc}
          </button>
        ))}
      </div>

      {/* Command Input Prompt Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
        }}
      >
        <span className="font-mono text-xs font-bold" style={{ color: 'var(--ot-cyan)' }}>
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command ('help', 'quote TSLA', 'theme bloomberg', 'scanlines')..."
          className="flex-1 bg-transparent text-xs font-mono outline-none text-slate-100 placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="p-1 rounded text-slate-400 hover:text-amber-400"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
