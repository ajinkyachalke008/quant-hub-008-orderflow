import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Wallet,
  PlusCircle,
  RotateCcw,
  AlertOctagon,
  Percent,
  TrendingDown,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { AccountVault, PaperAccountState } from '../../types/terminal';

export const AccountManagerWidget: React.FC = () => {
  const [vaults, setVaults] = useState<AccountVault[]>(() => paperTradingEngine.getVaults());
  const [activeAccount, setActiveAccount] = useState<PaperAccountState>(() => paperTradingEngine.getFullState().account);
  const [activeVaultId, setActiveVaultId] = useState<string>(() => paperTradingEngine.getFullState().activeVaultId);

  // New account form state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newBalance, setNewBalance] = useState<number>(100000);
  const [newLeverage, setNewLeverage] = useState<number>(50);
  const [newMaxDrawdown, setNewMaxDrawdown] = useState<number>(5.0);

  useEffect(() => {
    const unsub = paperTradingEngine.subscribe((state) => {
      setActiveAccount(state.account);
      setVaults(state.vaults);
      setActiveVaultId(state.activeVaultId);
    });
    return unsub;
  }, []);

  const handleSwitch = (id: string) => {
    paperTradingEngine.switchAccount(id);
  };

  const handleResetBreaker = () => {
    paperTradingEngine.resetCircuitBreaker();
  };

  const handleResetAccount = () => {
    if (confirm(`Reset "${activeAccount.name}" equity to $${activeAccount.initialBalance.toLocaleString()}? All positions will be cleared.`)) {
      paperTradingEngine.resetAccount();
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    paperTradingEngine.createAccount(newName, newBalance, newLeverage, newMaxDrawdown);
    setShowCreateModal(false);
    setNewName('');
  };

  // Compute Daily Drawdown %
  const dailyLoss = activeAccount.dailyStartingEquity - activeAccount.equity;
  const dailyDrawdownPercent = activeAccount.dailyStartingEquity > 0
    ? Math.max(0, (dailyLoss / activeAccount.dailyStartingEquity) * 100)
    : 0;

  const drawdownProgress = Math.min(100, (dailyDrawdownPercent / activeAccount.maxDailyDrawdownPercent) * 100);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[var(--accent-cyan)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-cyan)]">
            Multi-Account Portfolio & Risk Limits
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Institutional Vaults
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--accent-cyan)]/20 hover:bg-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/50 font-bold transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>NEW VAULT</span>
          </button>
          <button
            onClick={handleResetAccount}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-color)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[#FF5252] border border-[var(--border-color)] transition-all"
            title="Reset active account"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* Circuit Breaker Status Banner */}
      {activeAccount.isCircuitBreakerTripped ? (
        <div className="p-3 bg-[#FF1744]/20 border-b border-[#FF1744] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5 text-[#FF1744]">
            <AlertOctagon className="w-5 h-5 fill-current text-white shrink-0" />
            <div>
              <span className="font-bold text-xs uppercase tracking-wider">
                CIRCUIT BREAKER TRIPPED — CAPITAL PRESERVATION LOCK ACTIVE
              </span>
              <p className="text-[10px] text-white/80">
                Daily drawdown reached -{dailyDrawdownPercent.toFixed(2)}% (Limit: {activeAccount.maxDailyDrawdownPercent}%). All positions liquidated. Trading locked for 24 hours.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetBreaker}
            className="px-3 py-1 bg-[#FF1744] hover:bg-[#D50000] text-white font-bold rounded text-xs shadow-lg transition-all"
          >
            OVERRIDE & UNLOCK
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 bg-[var(--accent-emerald)]/10 border-b border-[var(--accent-emerald)]/30 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-[var(--accent-emerald)]">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-bold uppercase">Risk Guardrails: ACTIVE (1:{activeAccount.leverage} Leverage)</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            Daily Breaker Threshold: -{activeAccount.maxDailyDrawdownPercent.toFixed(1)}% Max Loss
          </span>
        </div>
      )}

      {/* Main Content Area: Vaults List + Active Vault Risk HUD */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left 1/3: Vault Selector Cards */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <span>Trading Vaults ({vaults.length})</span>
            <span>Switch</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {vaults.map((vault) => {
              const isSelected = vault.id === activeVaultId;
              return (
                <div
                  key={vault.id}
                  onClick={() => handleSwitch(vault.id)}
                  className={`p-2.5 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--accent-cyan)]/15 border-[var(--accent-cyan)] shadow-[0_0_12px_rgba(0,240,255,0.15)]'
                      : 'bg-[var(--surface-color)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-[var(--text-color)]">{vault.name}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--accent-amber)] font-bold">
                      1:{vault.leverage}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[var(--text-muted)]">Equity:</span>
                    <span className="font-bold text-[var(--accent-emerald)]">${vault.equity.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span>Drawdown Limit:</span>
                    <span className="text-[#FF5252]">-{vault.maxDailyDrawdownPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2/3: Active Account Risk HUD & Limits */}
        <div className="md:col-span-2 flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-3 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Selected Vault</span>
              <h2 className="text-base font-bold text-[var(--accent-amber)]">{activeAccount.name}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Equity Available</span>
              <span className="text-lg font-bold text-[var(--accent-emerald)]">${activeAccount.equity.toLocaleString()}</span>
            </div>
          </div>

          {/* Daily Drawdown Progress Meter */}
          <div className="p-3 rounded bg-[var(--surface-color)] border border-[var(--border-color)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[var(--text-color)] font-bold text-xs">
                <TrendingDown className="w-4 h-4 text-[#FF5252]" />
                <span>Daily Drawdown Tracker</span>
              </div>
              <span className="text-xs font-bold text-[#FF5252]">
                -{dailyDrawdownPercent.toFixed(2)}% / -{activeAccount.maxDailyDrawdownPercent.toFixed(1)}% Limit
              </span>
            </div>

            {/* Gauge Bar */}
            <div className="w-full h-2.5 rounded-full bg-[var(--surface-elevated)] overflow-hidden border border-[var(--border-color)]">
              <div
                className={`h-full transition-all duration-300 ${
                  drawdownProgress >= 80 ? 'bg-[#FF1744]' : drawdownProgress >= 50 ? 'bg-[var(--accent-amber)]' : 'bg-[var(--accent-emerald)]'
                }`}
                style={{ width: `${Math.max(2, drawdownProgress)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>Session Baseline: ${activeAccount.dailyStartingEquity.toLocaleString()}</span>
              <span>Drawdown Dollar: -${Math.max(0, dailyLoss).toLocaleString()}</span>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Balance</span>
              <span className="font-bold text-xs text-[var(--text-color)]">${activeAccount.balance.toLocaleString()}</span>
            </div>

            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Margin Used</span>
              <span className="font-bold text-xs text-[var(--accent-amber)]">${activeAccount.marginUsed.toLocaleString()}</span>
            </div>

            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Free Margin</span>
              <span className="font-bold text-xs text-[var(--accent-cyan)]">${activeAccount.freeMargin.toLocaleString()}</span>
            </div>

            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Margin Level</span>
              <span className="font-bold text-xs text-[var(--accent-emerald)]">{activeAccount.marginLevel}%</span>
            </div>
          </div>

          {/* Historical Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Total Trades</span>
              <span className="font-bold text-xs text-[var(--text-color)]">{activeAccount.totalTrades}</span>
            </div>

            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Win Rate</span>
              <span className="font-bold text-xs text-[var(--accent-emerald)]">{activeAccount.winRate}%</span>
            </div>

            <div className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)]">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block">Profit Factor</span>
              <span className="font-bold text-xs text-[var(--accent-amber)]">{activeAccount.profitFactor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded-lg p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="font-bold text-sm text-[var(--accent-cyan)] uppercase">Create Sub-Account Vault</span>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Vault Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. London Session Scalper"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-cyan)]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Initial Balance ($)</label>
                <input
                  type="number"
                  step="5000"
                  min="5000"
                  max="1000000"
                  value={newBalance}
                  onChange={(e) => setNewBalance(Number(e.target.value))}
                  className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-cyan)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Leverage</label>
                  <select
                    value={newLeverage}
                    onChange={(e) => setNewLeverage(Number(e.target.value))}
                    className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value={10}>1:10 (Conservative)</option>
                    <option value={20}>1:20 (Standard)</option>
                    <option value={50}>1:50 (Institutional)</option>
                    <option value={100}>1:100 (Aggressive)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Daily Max Loss (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="20"
                    value={newMaxDrawdown}
                    onChange={(e) => setNewMaxDrawdown(Number(e.target.value))}
                    className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded bg-[var(--border-color)] text-[var(--text-muted)] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[var(--accent-cyan)] text-black font-bold text-xs"
                >
                  Create Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
