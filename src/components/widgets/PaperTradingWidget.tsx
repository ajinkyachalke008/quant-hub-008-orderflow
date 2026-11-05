import React, { useState, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { exportTradeJournalToCSV } from '../../services/commandEngine';
import {
  PaperAccountState,
  PaperPosition,
  PaperOrder,
  PaperTradeJournalEntry,
  AccountVault,
} from '../../types/terminal';
import {
  TrendingUp,
  TrendingDown,
  Download,
  RotateCcw,
  AlertTriangle,
  Clock,
  Briefcase,
  XCircle,
  Layers,
  ChevronDown,
  AlertOctagon,
  Shield,
} from 'lucide-react';

export const PaperTradingWidget: React.FC = () => {
  const { activeQuote, activeSymbol } = useTerminal();
  const currentPrice = activeQuote?.price || 4040.0;

  const [activeTab, setActiveTab] = useState<'trade' | 'positions' | 'orders' | 'journal'>('trade');
  const [account, setAccount] = useState<PaperAccountState>(() => paperTradingEngine.getFullState().account);
  const [positions, setPositions] = useState<PaperPosition[]>(() => paperTradingEngine.getFullState().positions);
  const [orders, setOrders] = useState<PaperOrder[]>(() => paperTradingEngine.getFullState().orders);
  const [history, setHistory] = useState<PaperTradeJournalEntry[]>(() => paperTradingEngine.getFullState().history);
  const [vaults, setVaults] = useState<AccountVault[]>(() => paperTradingEngine.getVaults());

  // Advanced order types: Market, Limit, OCO, Trailing SL, Iceberg
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'oco' | 'trailing' | 'iceberg'>('market');
  const [lots, setLots] = useState<number>(1.0);
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice);
  const [ocoStopPrice, setOcoStopPrice] = useState<number>(currentPrice + 10);
  const [trailingDistance, setTrailingDistance] = useState<number>(5.0);
  const [icebergTotalLots, setIcebergTotalLots] = useState<number>(5.0);
  const [icebergVisibleLots, setIcebergVisibleLots] = useState<number>(0.5);

  const [slPrice, setSlPrice] = useState<string>('');
  const [tpPrice, setTpPrice] = useState<string>('');
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);

  useEffect(() => {
    const unsub = paperTradingEngine.subscribe((state) => {
      setAccount({ ...state.account });
      setPositions([...state.positions]);
      setOrders([...state.orders]);
      setHistory([...state.history]);
      setVaults([...state.vaults]);
    });
    return unsub;
  }, []);

  // Tick crossing updates on live price change
  useEffect(() => {
    if (currentPrice > 0) {
      paperTradingEngine.onPriceTick(activeSymbol, currentPrice);
    }
  }, [currentPrice, activeSymbol]);

  // Keep limit price in sync if pristine
  useEffect(() => {
    if (orderType === 'limit' && limitPrice === 4040.0 && currentPrice > 0) {
      setLimitPrice(currentPrice);
      setOcoStopPrice(currentPrice + 10);
    }
  }, [currentPrice]);

  const showFeedback = (msg: string, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleVaultChange = (id: string) => {
    paperTradingEngine.switchAccount(id);
    showFeedback(`Switched to vault: ${vaults.find((v) => v.id === id)?.name}`);
  };

  const handleExecute = (side: 'buy' | 'sell') => {
    const sl = slPrice ? parseFloat(slPrice) : undefined;
    const tp = tpPrice ? parseFloat(tpPrice) : undefined;

    if (orderType === 'market') {
      const res = paperTradingEngine.placeMarketOrder(activeSymbol, side, lots, sl, tp);
      showFeedback(res.message, !res.success);
    } else if (orderType === 'limit') {
      const res = paperTradingEngine.placeLimitOrder(activeSymbol, side, lots, limitPrice, sl, tp);
      showFeedback(res.message, !res.success);
    } else if (orderType === 'oco') {
      const res = paperTradingEngine.placeOcoOrder(activeSymbol, side, lots, limitPrice, ocoStopPrice, sl, tp);
      showFeedback(res.message, !res.success);
    } else if (orderType === 'trailing') {
      const res = paperTradingEngine.placeMarketOrder(activeSymbol, side, lots, sl, tp, trailingDistance);
      showFeedback(res.message, !res.success);
    } else if (orderType === 'iceberg') {
      const res = paperTradingEngine.placeIcebergOrder(activeSymbol, side, icebergTotalLots, icebergVisibleLots, limitPrice, sl, tp);
      showFeedback(res.message, !res.success);
    }
  };

  const handleClosePosition = (id: string) => {
    paperTradingEngine.closePosition(id);
    showFeedback('Closed position at market');
  };

  const handleCloseAll = () => {
    const count = paperTradingEngine.closeAllPositions();
    showFeedback(`Liquidated all ${count} open positions at market`);
  };

  const handleCancelOrder = (id: string) => {
    paperTradingEngine.cancelOrder(id);
    showFeedback('Order cancelled');
  };

  return (
    <div className="bg-[var(--surface-color)] border border-[var(--border-color)] rounded-md flex flex-col h-full overflow-hidden text-xs font-mono select-none">
      {/* Top Header with Vault Selector & Equity HUD */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
          <span className="font-bold text-[var(--accent-amber)] uppercase tracking-wider">
            Execution Matrix
          </span>

          {/* Quick Vault Switcher Dropdown */}
          <select
            value={account.id}
            onChange={(e) => handleVaultChange(e.target.value)}
            className="bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--accent-cyan)] font-bold text-[11px] rounded px-2 py-0.5 outline-none cursor-pointer hover:border-[var(--accent-cyan)]"
          >
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (1:{v.leverage})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] mr-1">EQUITY:</span>
            <strong className="text-[var(--accent-emerald)] font-bold">
              ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] mr-1">FREE MARGIN:</span>
            <span className="text-[var(--text-color)]">
              ${account.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] mr-1">MARGIN LVL:</span>
            <span
              className={`font-semibold ${
                account.marginLevel < 100 && account.marginUsed > 0 ? 'text-[#FF5252]' : 'text-[var(--accent-emerald)]'
              }`}
            >
              {account.marginLevel > 0 ? `${account.marginLevel.toFixed(1)}%` : '∞'}
            </span>
          </div>
        </div>
      </div>

      {/* Circuit Breaker Warning Alert if Active */}
      {account.isCircuitBreakerTripped && (
        <div className="px-3 py-1.5 bg-[#FF1744]/20 border-b border-[#FF1744] text-[#FF1744] flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>CIRCUIT BREAKER ACTIVE (-{account.maxDailyDrawdownPercent}% Max Loss Hit). Trading is locked.</span>
          </div>
          <button
            onClick={() => paperTradingEngine.resetCircuitBreaker()}
            className="px-2 py-0.5 rounded bg-[#FF1744] text-white text-[10px] uppercase font-bold"
          >
            Override
          </button>
        </div>
      )}

      {/* Tabs Row */}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--surface-color)] border-b border-[var(--border-color)] text-[11px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('trade')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'trade'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/40'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            ORDER TICKET
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'positions'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/40'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <span>POSITIONS</span>
            {positions.length > 0 && (
              <span className="bg-[var(--accent-cyan)] text-black text-[9px] font-bold px-1 rounded-full">
                {positions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/40'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            <span>ORDERS</span>
            {orders.length > 0 && (
              <span className="bg-[var(--accent-amber)] text-black text-[9px] font-bold px-1 rounded-full">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'journal'
                ? 'bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold border border-[var(--accent-cyan)]/40'
                : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
            }`}
          >
            HISTORY ({history.length})
          </button>
        </div>

        {activeTab === 'positions' && positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            className="text-[10px] px-2 py-0.5 rounded bg-[#FF5252]/20 hover:bg-[#FF5252]/30 text-[#FF5252] font-bold border border-[#FF5252]/40"
          >
            CLOSE ALL
          </button>
        )}

        {activeTab === 'journal' && history.length > 0 && (
          <button
            onClick={exportTradeJournalToCSV}
            className="flex items-center gap-1 text-[10px] text-[var(--accent-cyan)] hover:underline"
          >
            <Download className="w-3 h-3" />
            <span>EXPORT CSV</span>
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-3 overflow-y-auto min-h-0">
        {feedback && (
          <div
            className={`mb-2.5 p-2 rounded text-xs border font-medium ${
              feedback.isError
                ? 'bg-[#FF5252]/15 border-[#FF5252]/50 text-[#FF5252]'
                : 'bg-[var(--accent-emerald)]/15 border-[var(--accent-emerald)]/50 text-[var(--accent-emerald)]'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* TAB 1: ORDER TICKET */}
        {activeTab === 'trade' && (
          <div className="space-y-3">
            {/* Order Type Tabs */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded">
              <button
                onClick={() => setOrderType('market')}
                className={`py-1 text-center rounded text-[10px] font-bold uppercase transition-all ${
                  orderType === 'market'
                    ? 'bg-[var(--accent-amber)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('limit')}
                className={`py-1 text-center rounded text-[10px] font-bold uppercase transition-all ${
                  orderType === 'limit'
                    ? 'bg-[var(--accent-amber)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                Limit
              </button>
              <button
                onClick={() => setOrderType('oco')}
                className={`py-1 text-center rounded text-[10px] font-bold uppercase transition-all ${
                  orderType === 'oco'
                    ? 'bg-[var(--accent-cyan)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                OCO
              </button>
              <button
                onClick={() => setOrderType('trailing')}
                className={`py-1 text-center rounded text-[10px] font-bold uppercase transition-all ${
                  orderType === 'trailing'
                    ? 'bg-[var(--accent-emerald)] text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                Trailing
              </button>
              <button
                onClick={() => setOrderType('iceberg')}
                className={`py-1 text-center rounded text-[10px] font-bold uppercase transition-all ${
                  orderType === 'iceberg'
                    ? 'bg-purple-400 text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
                }`}
              >
                Iceberg
              </button>
            </div>

            {/* Inputs Grid based on Order Type */}
            <div className="grid grid-cols-2 gap-2">
              {/* Lots Input (or Iceberg inputs) */}
              {orderType === 'iceberg' ? (
                <>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                      Total Institutional Lots
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={icebergTotalLots}
                      onChange={(e) => setIcebergTotalLots(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                      Visible Tranche Lots
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={icebergVisibleLots}
                      onChange={(e) => setIcebergVisibleLots(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                    Contract Lots (100 oz / lot)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={lots}
                    onChange={(e) => setLots(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>
              )}

              {/* Price / Limit Price Input */}
              {orderType === 'market' ? (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                    Live Spot Execution
                  </label>
                  <div className="px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded font-bold text-[var(--accent-cyan)]">
                    ${currentPrice.toFixed(2)}
                  </div>
                </div>
              ) : orderType === 'trailing' ? (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                    Trailing Offset ($)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    value={trailingDistance}
                    onChange={(e) => setTrailingDistance(Math.max(0.5, parseFloat(e.target.value) || 1.0))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                    Limit Target Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(parseFloat(e.target.value) || currentPrice)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none focus:border-[var(--accent-cyan)]"
                  />
                </div>
              )}
            </div>

            {/* OCO Secondary Stop Price input */}
            {orderType === 'oco' && (
              <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--accent-cyan)]/30 space-y-1">
                <span className="text-[9px] uppercase font-bold text-[var(--accent-cyan)] block">
                  OCO Linked Stop Trigger (Breakout)
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={ocoStopPrice}
                  onChange={(e) => setOcoStopPrice(parseFloat(e.target.value) || currentPrice)}
                  className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                />
              </div>
            )}

            {/* Stop Loss & Take Profit Fields */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                  Stop Loss Price ($)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Optional SL"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                  Take Profit Price ($)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Optional TP"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  className="w-full bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-[var(--text-color)] outline-none"
                />
              </div>
            </div>

            {/* Margin Requirement Summary under Active Leverage */}
            <div className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)]">Margin Required (1:{account.leverage}):</span>
              <strong className="text-[var(--accent-amber)]">
                ${(((orderType === 'iceberg' ? icebergVisibleLots : lots) * 100 * currentPrice) / account.leverage).toFixed(2)}
              </strong>
            </div>

            {/* Execution Buttons: BUY (LONG) / SELL (SHORT) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleExecute('buy')}
                disabled={account.isCircuitBreakerTripped}
                className="py-2.5 rounded bg-[var(--accent-emerald)] hover:bg-[#00c853] text-black font-bold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-md"
              >
                <TrendingUp className="w-4 h-4" />
                <span>BUY / LONG</span>
              </button>
              <button
                onClick={() => handleExecute('sell')}
                disabled={account.isCircuitBreakerTripped}
                className="py-2.5 rounded bg-[#FF5252] hover:bg-[#d50000] text-white font-bold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-md"
              >
                <TrendingDown className="w-4 h-4" />
                <span>SELL / SHORT</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE POSITIONS */}
        {activeTab === 'positions' && (
          <div className="space-y-2">
            {positions.length > 0 ? (
              positions.map((pos) => {
                const isWin = pos.unrealizedPnl >= 0;
                return (
                  <div
                    key={pos.id}
                    className="p-2.5 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            pos.side === 'buy' ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                          }`}
                        >
                          {pos.side.toUpperCase()} {pos.lots}L
                        </span>
                        <strong className="text-[var(--text-color)]">{pos.symbol}</strong>
                        {pos.trailingStopDistance && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] font-bold">
                            TRAILING ${pos.trailingStopDistance}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Entry: ${pos.entryPrice.toFixed(2)} | Current: ${pos.currentPrice.toFixed(2)}
                        {pos.sl && ` | SL: $${pos.sl.toFixed(2)}`}
                        {pos.tp && ` | TP: $${pos.tp.toFixed(2)}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`font-bold text-xs ${isWin ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                          {isWin ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div className={`text-[10px] ${isWin ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                          ({isWin ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(1)}%)
                        </div>
                      </div>
                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        className="px-2 py-1 rounded bg-[#FF5252]/20 hover:bg-[#FF5252]/30 text-[#FF5252] font-bold text-[10px] border border-[#FF5252]/40"
                      >
                        CLOSE
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                No active open positions in this vault.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PENDING ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {orders.length > 0 ? (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--accent-amber)]/20 text-[var(--accent-amber)] uppercase">
                        {ord.type} {ord.side}
                      </span>
                      <strong className="text-[var(--text-color)]">
                        {ord.lots}L {ord.symbol} @ ${ord.targetPrice.toFixed(2)}
                      </strong>
                      {ord.ocoGroupId && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)]">
                          OCO LINKED
                        </span>
                      )}
                      {ord.type === 'iceberg' && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-purple-400/20 text-purple-400">
                          ICEBERG ({ord.executedLots || 0}/{ord.totalLots}L)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Placed: {ord.createdAt.slice(11, 19)} UTC
                      {ord.sl && ` | SL: $${ord.sl.toFixed(2)}`}
                      {ord.tp && ` | TP: $${ord.tp.toFixed(2)}`}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCancelOrder(ord.id)}
                    className="text-[#FF5252] hover:text-[#FF1744] p-1"
                    title="Cancel order"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                No resting pending orders.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: JOURNAL HISTORY */}
        {activeTab === 'journal' && (
          <div className="space-y-1.5 font-mono text-[11px]">
            {history.length > 0 ? (
              history.map((h) => {
                const isWin = h.realizedPnl >= 0;
                return (
                  <div
                    key={h.id}
                    className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                            h.side === 'buy' ? 'bg-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                          }`}
                        >
                          {h.side.toUpperCase()} {h.lots}L
                        </span>
                        <span className="text-[var(--text-color)]">
                          ${h.entryPrice.toFixed(2)} → ${h.exitPrice.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)] uppercase">({h.reason})</span>
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)]">
                        Close: {h.closeTime.slice(11, 19)} UTC
                      </div>
                    </div>

                    <strong className={`text-xs ${isWin ? 'text-[var(--accent-emerald)]' : 'text-[#FF5252]'}`}>
                      {isWin ? '+' : ''}${h.realizedPnl.toFixed(2)}
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                No trades executed in this vault yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
