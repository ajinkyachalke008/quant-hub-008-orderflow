import React, { useState, useEffect } from 'react';
import { fixSessionManagerService } from '../../services/fixSessionManagerService';
import { FixMessage, FixSessionState, FixTag } from '../../types/terminal';
import {
  FileText,
  Activity,
  Zap,
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Send,
  Edit3,
} from 'lucide-react';

export const FixSessionManager: React.FC = () => {
  const [session, setSession] = useState<FixSessionState>(() => fixSessionManagerService.getState());
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Cancel/Replace dialog state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [origOrderId, setOrigOrderId] = useState('ord_gold_1001');
  const [replacePrice, setReplacePrice] = useState('4042.50');
  const [replaceLots, setReplaceLots] = useState('1.5');

  useEffect(() => {
    const unsub = fixSessionManagerService.subscribe((s) => {
      setSession({ ...s });
    });
    return unsub;
  }, []);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendReplace = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(replacePrice);
    const q = parseFloat(replaceLots);
    if (!isNaN(p) && !isNaN(q)) {
      fixSessionManagerService.sendOrderCancelReplace(origOrderId, p, q);
      setShowReplaceModal(false);
    }
  };

  const filteredMessages = session.messages.filter((m) => {
    if (filterType === 'ALL') return true;
    return m.msgType === filterType;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--accent-cyan)]" />
          <span className="font-bold tracking-wider text-[var(--text-color)] uppercase">
            FIX 4.4 Protocol Session Manager & Raw Packet Hub
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              session.status === 'CONNECTED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : session.status === 'LOGON_SENT'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}
          >
            {session.status}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>
            Desk: <span className="font-bold text-[var(--text-color)]">{session.senderCompId}</span>
          </span>
          <span>
            Target: <span className="font-bold text-[var(--text-color)]">{session.targetCompId}</span>
          </span>
          <span>
            In/Out Seq: <span className="font-bold text-[var(--accent-amber)]">{session.inboundSeqNum}/{session.outboundSeqNum}</span>
          </span>
        </div>
      </div>

      {/* Interactive Session Control Toolbar */}
      <div className="p-2.5 bg-[var(--surface-color)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {session.status === 'CONNECTED' ? (
            <button
              onClick={() => fixSessionManagerService.logout()}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded font-bold transition-all text-[11px]"
            >
              <Square className="w-3.5 h-3.5" />
              <span>LOGOUT (35=5)</span>
            </button>
          ) : (
            <button
              onClick={() => fixSessionManagerService.logon()}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded font-bold transition-all text-[11px]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>LOGON (35=A)</span>
            </button>
          )}

          <button
            onClick={() => fixSessionManagerService.sendHeartbeat()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--accent-amber)] rounded font-bold transition-all text-[11px]"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>HEARTBEAT (35=0)</span>
          </button>

          <button
            onClick={() => fixSessionManagerService.sendTestRequest()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--accent-cyan)] rounded font-bold transition-all text-[11px]"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>TEST REQ (35=1)</span>
          </button>

          <button
            onClick={() => setShowReplaceModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/40 rounded font-bold transition-all text-[11px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>CANCEL/REPLACE (35=G)</span>
          </button>

          <button
            onClick={() => fixSessionManagerService.resetSequenceNumbers()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white rounded transition-all text-[11px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET SEQ</span>
          </button>
        </div>

        {/* Message Type Filter */}
        <div className="flex items-center gap-1 text-[11px]">
          <Filter className="w-3 h-3 text-[var(--text-muted)]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-[var(--text-color)] focus:outline-none"
          >
            <option value="ALL">ALL MSGS ({session.messages.length})</option>
            <option value="35=D">35=D (New Order Single)</option>
            <option value="35=8">35=8 (Execution Report)</option>
            <option value="35=G">35=G (Cancel/Replace)</option>
            <option value="35=0">35=0 (Heartbeat)</option>
            <option value="35=A">35=A (Logon)</option>
            <option value="35=1">35=1 (Test Request)</option>
          </select>
        </div>
      </div>

      {/* Main Content: Message Feed & Tag Dictionary Inspector */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left: Messages Feed */}
        <div className="w-full md:w-1/2 border-r border-[var(--border-color)] overflow-y-auto p-2 space-y-1.5">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-10 text-[var(--text-muted)] text-[11px]">
              No matching FIX messages logged. Trigger a heartbeat or order above.
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isSelected = selectedMsgId === msg.id;
              const isOrder = msg.msgType === '35=D' || msg.msgType === '35=8' || msg.msgType === '35=G';
              return (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMsgId(msg.id)}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[var(--accent-amber)] bg-[var(--surface-elevated)]'
                      : 'border-[var(--border-color)] bg-[var(--surface-color)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                        msg.msgType === '35=D'
                          ? 'bg-blue-500/20 text-blue-400'
                          : msg.msgType === '35=8'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : msg.msgType === '35=G'
                          ? 'bg-purple-500/20 text-purple-400'
                          : msg.msgType === '35=0'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {msg.typeLabel}
                    </span>

                    <span className="text-[10px] text-[var(--text-muted)]">
                      Seq #{msg.seqNum} | {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                    {msg.raw}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Packet Tag-by-Tag Decoder */}
        <div className="w-full md:w-1/2 flex flex-col min-h-0 bg-[var(--surface-elevated)] p-3">
          {selectedMsgId ? (
            (() => {
              const msg = session.messages.find((m) => m.id === selectedMsgId);
              if (!msg) return null;
              return (
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-[var(--accent-amber)]">{msg.typeLabel}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Seq #{msg.seqNum}</span>
                    </div>

                    <button
                      onClick={() => handleCopy(msg.id, msg.raw)}
                      className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-white px-2 py-0.5 rounded border border-[var(--border-color)]"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Raw SOH</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Raw Packet Box */}
                  <div className="p-2 bg-[var(--surface-color)] rounded border border-[var(--border-color)] text-[10px] font-mono break-all text-[var(--text-muted)] mb-3">
                    {msg.raw}
                  </div>

                  {/* Tag Dictionary Table */}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-color)]">
                          <th className="pb-1 font-normal w-12">Tag</th>
                          <th className="pb-1 font-normal">Field Name</th>
                          <th className="pb-1 font-normal">Value</th>
                          <th className="pb-1 font-normal">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)] font-mono text-[10px]">
                        {msg.tags.map((t, idx) => (
                          <tr key={`${msg.id}_${t.tag}_${idx}`} className="hover:bg-[var(--surface-color)]">
                            <td className="py-1 font-bold text-[var(--accent-cyan)]">{t.tag}</td>
                            <td className="py-1 text-[var(--text-color)]">{t.name}</td>
                            <td className="py-1 font-bold text-[var(--accent-amber)]">{t.value}</td>
                            <td className="py-1 text-[var(--text-muted)]">{t.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
              Select any message from the left to inspect decoded FIX tags and checksum.
            </div>
          )}
        </div>
      </div>

      {/* Order Cancel/Replace Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg p-4 w-full max-w-sm flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="font-bold text-[var(--accent-cyan)] flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                FIX 4.4 ORDER CANCEL/REPLACE (35=G)
              </span>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendReplace} className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">ORIGINAL CLORDID (TAG 41)</label>
                <input
                  type="text"
                  value={origOrderId}
                  onChange={(e) => setOrigOrderId(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-xs text-[var(--text-color)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">NEW LIMIT PRICE ($)</label>
                <input
                  type="number"
                  step="0.05"
                  value={replacePrice}
                  onChange={(e) => setReplacePrice(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-xs text-[var(--text-color)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">NEW QUANTITY (LOTS)</label>
                <input
                  type="number"
                  step="0.1"
                  value={replaceLots}
                  onChange={(e) => setReplaceLots(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-xs text-[var(--text-color)]"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  className="px-3 py-1 bg-[var(--surface-elevated)] text-[var(--text-muted)] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded"
                >
                  TRANSMIT 35=G
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
