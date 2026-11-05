import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  Zap,
  Shield,
  Activity,
  Layers,
  Info,
} from 'lucide-react';
import { fixProtocolEngine } from '../../services/fixProtocolEngine';
import { FixMessage, FixTag } from '../../types/terminal';

export const FixAuditTrailWidget: React.FC = () => {
  const [messages, setMessages] = useState<FixMessage[]>(() => fixProtocolEngine.getMessages());
  const [selectedMessage, setSelectedMessage] = useState<FixMessage | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = fixProtocolEngine.subscribe((msgs) => setMessages(msgs));
    return unsub;
  }, []);

  const handleCopy = (raw: string, id: string) => {
    navigator.clipboard.writeText(raw);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendHeartbeat = () => {
    fixProtocolEngine.generateHeartbeat();
  };

  const handleClear = () => {
    fixProtocolEngine.clearAuditTrail();
    setSelectedMessage(null);
  };

  const filteredMessages = messages.filter((m) => {
    if (filterType === 'ALL') return true;
    return m.msgType === filterType;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--accent-cyan)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-cyan)]">
            FIX 4.4 Protocol Simulator & Audit Trail
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)] font-bold">
            SOH (|) Tagged Packet Stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Message Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[var(--surface-color)] border border-[var(--border-color)] text-xs text-[var(--text-color)] rounded px-2 py-0.5 outline-none cursor-pointer"
          >
            <option value="ALL">All Packets ({messages.length})</option>
            <option value="35=D">35=D (New Order Single)</option>
            <option value="35=8">35=8 (Execution Report)</option>
            <option value="35=F">35=F (Cancel Request)</option>
            <option value="35=0">35=0 (Heartbeat)</option>
          </select>

          <button
            onClick={handleSendHeartbeat}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-amber)]/20 hover:bg-[var(--accent-amber)]/30 text-[var(--accent-amber)] border border-[var(--accent-amber)]/50 font-bold text-[10px] transition-all"
            title="Inject 35=0 Heartbeat ping"
          >
            <Zap className="w-3 h-3" />
            <span>HEARTBEAT</span>
          </button>

          <button
            onClick={handleClear}
            className="text-[var(--text-muted)] hover:text-[#FF5252] p-1 transition-colors"
            title="Clear FIX Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split: Packet Stream & Tag Decoder */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left 7 cols: Raw Message Stream */}
        <div className="md:col-span-7 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-[var(--border-color)] text-[10px] text-[var(--text-muted)] font-bold uppercase">
            <span>Transmission Log ({filteredMessages.length})</span>
            <span>Click packet to decode tags</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`p-2 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-cyan)]/15 border-[var(--accent-cyan)] shadow-[0_0_8px_rgba(0,240,255,0.1)]'
                        : 'bg-[var(--surface-color)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            msg.msgType === '35=D'
                              ? 'bg-[var(--accent-amber)] text-black'
                              : msg.msgType === '35=8'
                              ? 'bg-[var(--accent-emerald)] text-black'
                              : msg.msgType === '35=F'
                              ? 'bg-[#FF5252] text-white'
                              : 'bg-blue-400 text-black'
                          }`}
                        >
                          {msg.msgType}
                        </span>
                        <strong className="text-xs text-[var(--text-color)]">{msg.typeLabel}</strong>
                        <span className="text-[10px] text-[var(--text-muted)]">Seq #{msg.seqNum}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--text-muted)]">{msg.timestamp.slice(11, 23)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(msg.raw, msg.id);
                          }}
                          className="text-[var(--text-muted)] hover:text-white"
                          title="Copy Raw FIX string"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-[var(--accent-emerald)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Raw string preview */}
                    <div className="text-[10px] text-[var(--text-muted)] font-mono break-all line-clamp-2">
                      {msg.raw}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)]">
                No FIX 4.4 messages logged. Place a paper trade or click Heartbeat to inspect packets.
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Interactive Tag-by-Tag Decoder */}
        <div className="md:col-span-5 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)] text-[10px] uppercase font-bold text-[var(--accent-amber)]">
            <span>FIX Tag Dictionary Decoder</span>
            {selectedMessage && <span>Seq #{selectedMessage.seqNum}</span>}
          </div>

          {selectedMessage ? (
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
              {selectedMessage.tags.map((t, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-[var(--surface-elevated)] text-[var(--accent-cyan)] font-bold text-[10px]">
                      {t.tag}
                    </span>
                    <div>
                      <strong className="text-xs text-[var(--text-color)] block leading-none">{t.name}</strong>
                      <span className="text-[9px] text-[var(--text-muted)]">{t.description}</span>
                    </div>
                  </div>

                  <strong className="text-xs text-[var(--accent-amber)] font-bold shrink-0">
                    {t.value}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
              <Info className="w-8 h-8 text-[var(--text-muted)]/50 mb-2" />
              <p className="text-xs">Select any transmission packet from the audit stream to inspect decoded FIX 4.4 tags.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
