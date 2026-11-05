import React, { useState, useEffect } from 'react';
import { subAccountRiskService } from '../../services/subAccountRiskService';
import { EmergencyPanicAuditLog, SubAccountDesk } from '../../types/terminal';
import {
  ShieldAlert,
  Lock,
  Unlock,
  AlertOctagon,
  Percent,
  TrendingUp,
  FileKey,
  ShieldCheck,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

export const SubAccountRiskWidget: React.FC = () => {
  const [desks, setDesks] = useState<SubAccountDesk[]>(() => subAccountRiskService.getDesks());
  const [totalEquity, setTotalEquity] = useState<number>(() => subAccountRiskService.getTotalEquity());
  const [panicLogs, setPanicLogs] = useState<EmergencyPanicAuditLog[]>(() => subAccountRiskService.getPanicLogs());

  const [showPanicConfirm, setShowPanicConfirm] = useState(false);
  const [panicExecuting, setPanicExecuting] = useState(false);
  const [lastAuditChecksum, setLastAuditChecksum] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subAccountRiskService.subscribe((d, eq, logs) => {
      setDesks([...d]);
      setTotalEquity(eq);
      setPanicLogs([...logs]);
    });
    return unsub;
  }, []);

  const handleToggleLock = (deskId: string) => {
    subAccountRiskService.toggleDeskLock(deskId);
  };

  const handleTriggerPanic = () => {
    setPanicExecuting(true);
    setTimeout(() => {
      const log = subAccountRiskService.executeEmergencyFlattenAll('RISK_DESK_ADMIN');
      setLastAuditChecksum(log.checksum);
      setPanicExecuting(false);
      setShowPanicConfirm(false);
    }, 500);
  };

  const handleUnlockAll = () => {
    subAccountRiskService.unlockAllDesks();
    setLastAuditChecksum(null);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold tracking-wider text-[var(--text-color)] uppercase">
            Multi-Tenant Sub-Account Risk & Capital Allocation Matrix
          </span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
            DESK SEGREGATION
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPanicConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-all shadow-sm shadow-red-900/50 animate-pulse text-[11px]"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>FLATTEN ALL & LOCK DESK</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Desks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {desks.map((desk) => {
            const isAtRisk = desk.currentDrawdownPct >= desk.maxDailyLossLimitPct * 0.75;
            return (
              <div
                key={desk.id}
                className={`p-3 rounded border flex flex-col justify-between transition-all ${
                  desk.isLocked
                    ? 'bg-red-950/20 border-red-500/50'
                    : 'bg-[var(--surface-elevated)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] mb-2">
                    <div>
                      <span className="font-bold text-xs text-[var(--text-color)] block">{desk.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{desk.code}</span>
                    </div>

                    <button
                      onClick={() => handleToggleLock(desk.id)}
                      className={`p-1.5 rounded transition-colors ${
                        desk.isLocked
                          ? 'bg-red-500 text-white'
                          : 'bg-[var(--surface-color)] text-[var(--text-muted)] hover:text-white'
                      }`}
                      title={desk.isLocked ? 'Desk Locked (Click to Unlock)' : 'Lock Desk'}
                    >
                      {desk.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Financial Metrics */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Allocated Capital:</span>
                      <span className="font-bold text-[var(--text-color)]">
                        ${desk.allocatedCapital.toLocaleString()} ({desk.allocatedCapitalPct}%)
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Desk Equity:</span>
                      <span className="font-bold text-[var(--accent-emerald)]">
                        ${desk.currentEquity.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Max Leverage Cap:</span>
                      <span className="font-bold text-[var(--accent-cyan)]">1:{desk.maxLeverage}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Daily Loss Cutoff:</span>
                      <span className="font-bold text-red-400">{desk.maxDailyLossLimitPct}%</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Current Drawdown:</span>
                      <span className={`font-bold ${isAtRisk ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                        -{desk.currentDrawdownPct}%
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Active Positions:</span>
                      <span className="font-bold text-[var(--text-color)]">{desk.activePositionsCount}</span>
                    </div>
                  </div>
                </div>

                {desk.isLocked && (
                  <div className="mt-3 p-1.5 bg-red-900/30 border border-red-500/40 rounded text-[10px] text-red-300 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-red-400 shrink-0" />
                    <span className="truncate">{desk.lockReason || 'Trading Desk Locked'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Global Controls & Unlock All Bar */}
        <div className="flex items-center justify-between p-2.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-[var(--text-muted)]">
              Total Master Ledger Equity:{' '}
              <span className="font-bold text-[var(--text-color)]">${totalEquity.toLocaleString()}</span>
            </span>
          </div>

          <button
            onClick={handleUnlockAll}
            className="px-3 py-1 bg-[var(--surface-color)] hover:bg-[var(--surface-elevated)] border border-[var(--border-color)] text-[var(--text-color)] rounded font-bold transition-all text-[11px]"
          >
            UNLOCK ALL DESKS
          </button>
        </div>

        {/* Emergency Panic Audit Logs Table */}
        <div className="bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] p-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] mb-2">
            <div className="flex items-center gap-2">
              <FileKey className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-xs text-[var(--text-color)]">
                EMERGENCY PANIC AUDIT TRAIL & CRYPTOGRAPHIC CHECKSUMS
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              SHA-256 Verifiable Liquidation Records
            </span>
          </div>

          {panicLogs.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)] text-[11px]">
              No emergency panic flatten events recorded. All desks operating normally.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-color)]">
                    <th className="pb-1.5 font-normal">Timestamp</th>
                    <th className="pb-1.5 font-normal">Initiator</th>
                    <th className="pb-1.5 font-normal">Orders Cancelled</th>
                    <th className="pb-1.5 font-normal">Positions Flattened</th>
                    <th className="pb-1.5 font-normal">Liquidated Value</th>
                    <th className="pb-1.5 font-normal">Audit Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-mono text-[11px]">
                  {panicLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-color)]">
                      <td className="py-2 text-[var(--text-muted)]">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-2 text-amber-400 font-bold">{log.initiator}</td>
                      <td className="py-2 text-[var(--text-color)]">{log.cancelledOrdersCount}</td>
                      <td className="py-2 text-red-400 font-bold">{log.flattenedPositionsCount}</td>
                      <td className="py-2 text-emerald-400 font-bold">${log.totalLiquidatedValue.toLocaleString()}</td>
                      <td className="py-2 text-purple-400 text-[10px] truncate max-w-xs">{log.checksum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Panic Flatten Confirmation Modal */}
      {showPanicConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-color)] border-2 border-red-500 rounded-lg p-5 w-full max-w-md flex flex-col gap-3 font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
              <span>CONFIRM EMERGENCY FLATTEN ALL & LOCK DESK</span>
            </div>

            <p className="text-[var(--text-muted)] leading-relaxed">
              WARNING: This action immediately cancels all active working orders across all books,
              liquidates all open positions at prevailing market price, locks all trading desks,
              and commits a cryptographic SHA-256 audit record to the ledger.
            </p>

            <div className="p-2.5 bg-red-950/30 border border-red-500/40 rounded text-red-300 text-[11px]">
              • Cancel all Limit, Stop, OCO, and Iceberg orders
              <br />
              • Market-close all Bullion & Multi-Asset positions
              <br />
              • Lock Alpha, Swing, and Arbitrage desks
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setShowPanicConfirm(false)}
                disabled={panicExecuting}
                className="px-4 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-color)] text-[var(--text-muted)] rounded font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerPanic}
                disabled={panicExecuting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-1.5"
              >
                {panicExecuting ? (
                  <span>EXECUTING LIQUIDATION...</span>
                ) : (
                  <>
                    <AlertOctagon className="w-4 h-4" />
                    <span>CONFIRM MASTER FLATTEN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
