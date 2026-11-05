import React, { useState, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { Calculator, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

export const PositionSizeCalculatorWidget: React.FC = () => {
  const { activeQuote, activeSymbol } = useTerminal();
  const currentPrice = activeQuote?.price || 4040.0;

  const [equity, setEquity] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1.0%
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice);
  const [stopLoss, setStopLoss] = useState<number>(Number((currentPrice - 20).toFixed(2)));
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  // Sync with current live price if entry wasn't edited
  useEffect(() => {
    if (entryPrice === 4040.0 && currentPrice > 0) {
      setEntryPrice(currentPrice);
      setStopLoss(Number((currentPrice - 20).toFixed(2)));
    }
  }, [currentPrice]);

  // Sync account equity from paper trading engine
  useEffect(() => {
    const unsub = paperTradingEngine.subscribe((state) => {
      if (state.account.equity > 0) {
        setEquity(state.account.equity);
      }
    });
    return unsub;
  }, []);

  const riskAmount = (equity * riskPercent) / 100;
  const priceDistance = Math.abs(entryPrice - stopLoss);
  const pipDistance = Number((priceDistance * 10).toFixed(1)); // 1 pip = $0.10 in Gold Spot

  // 1 Standard Lot = 100 oz Gold. Each $1 move = $100 P&L per standard lot.
  const rawLots = priceDistance > 0 ? riskAmount / (priceDistance * 100) : 0;
  const standardLots = Number(rawLots.toFixed(2));
  const miniLots = Number((rawLots * 10).toFixed(1));
  const microLots = Number((rawLots * 100).toFixed(0));

  // Required Margin under 1:50 leverage: (standardLots * 100 * entryPrice) / 50
  const requiredMargin = (standardLots * 100 * entryPrice) / 50;

  // Reward Targets
  const isLong = entryPrice >= stopLoss;
  const tp1to2 = isLong
    ? Number((entryPrice + priceDistance * 2).toFixed(2))
    : Number((entryPrice - priceDistance * 2).toFixed(2));
  const tp1to3 = isLong
    ? Number((entryPrice + priceDistance * 3).toFixed(2))
    : Number((entryPrice - priceDistance * 3).toFixed(2));

  const handleApplyTrade = (side: 'buy' | 'sell') => {
    const res = paperTradingEngine.placeMarketOrder(
      activeSymbol,
      side,
      standardLots > 0 ? standardLots : 0.1,
      stopLoss,
      tp1to2
    );
    if (res.success) {
      setAppliedMsg(`Order placed: ${side.toUpperCase()} ${standardLots} lots`);
      setTimeout(() => setAppliedMsg(null), 3000);
    } else {
      setAppliedMsg(`Error: ${res.message}`);
      setTimeout(() => setAppliedMsg(null), 4000);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md flex flex-col h-full overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--accent)]">POSITION & LOT RISK CALCULATOR</span>
          <span className="text-[10px] text-[var(--text-muted)]">1:50 LEVERAGE</span>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {activeSymbol} SPOT: <strong className="text-[var(--text-primary)]">${currentPrice.toFixed(2)}</strong>
        </span>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        {/* Input Parameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">EQUITY ($)</label>
            <input
              type="number"
              value={equity}
              onChange={(e) => setEquity(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">RISK %</label>
            <div className="flex items-center gap-1">
              {[0.5, 1.0, 2.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskPercent(r)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    riskPercent === r
                      ? 'bg-[var(--accent)] text-black font-semibold'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r}%
                </button>
              ))}
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0.1)}
                className="w-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-1 py-1 text-center text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">ENTRY PRICE ($)</label>
            <input
              type="number"
              step="0.1"
              value={entryPrice}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1">STOP LOSS ($)</label>
            <input
              type="number"
              step="0.1"
              value={stopLoss}
              onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Calculated Sizing Output Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-center">
            <span className="text-[10px] text-[var(--text-muted)] block">STANDARD LOTS (100 oz)</span>
            <span className="text-base font-bold text-[var(--accent)]">{standardLots}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">
              Req. Margin: ${requiredMargin.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="p-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-center">
            <span className="text-[10px] text-[var(--text-muted)] block">MINI LOTS (10 oz)</span>
            <span className="text-base font-bold text-[var(--text-primary)]">{miniLots}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">Dollar Risk: ${riskAmount.toFixed(0)}</span>
          </div>

          <div className="p-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded text-center">
            <span className="text-[10px] text-[var(--text-muted)] block">MICRO LOTS (1 oz)</span>
            <span className="text-base font-bold text-[var(--text-secondary)]">{microLots}</span>
            <span className="text-[10px] text-[var(--text-muted)] block">Dist: {pipDistance} pips</span>
          </div>
        </div>

        {/* Risk / Reward Projection Targets */}
        <div className="p-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Target R:R Models:</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px]">
              1:2 R:R Target: <strong className="text-emerald-400">${tp1to2}</strong> (+$
              {(riskAmount * 2).toFixed(0)})
            </span>
            <span className="text-[11px]">
              1:3 R:R Target: <strong className="text-emerald-400">${tp1to3}</strong> (+$
              {(riskAmount * 3).toFixed(0)})
            </span>
          </div>
        </div>

        {appliedMsg && (
          <div className="p-1.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{appliedMsg}</span>
          </div>
        )}

        {/* 1-Click Apply Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleApplyTrade('buy')}
            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded flex items-center justify-center gap-1 transition-colors"
          >
            <span>EXECUTE BUY {standardLots} LOTS</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleApplyTrade('sell')}
            className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded flex items-center justify-center gap-1 transition-colors"
          >
            <span>EXECUTE SELL {standardLots} LOTS</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
