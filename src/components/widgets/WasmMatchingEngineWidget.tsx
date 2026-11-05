import React, { useState, useEffect } from 'react';
import { wasmMatchingEngine } from '../../wasm/matchingEngine';
import {
  Full50LevelDomBook,
  WasmExecutionReport,
  WasmOrderSide,
  WasmOrderType,
} from '../../types/terminal';
import { Cpu, Zap, ArrowDown, ArrowUp, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export const WasmMatchingEngineWidget: React.FC = () => {
  const [domBook, setDomBook] = useState<Full50LevelDomBook>(() => wasmMatchingEngine.getDomBook());
  const [reports, setReports] = useState<WasmExecutionReport[]>(() => wasmMatchingEngine.getReports());

  const [side, setSide] = useState<WasmOrderSide>('BUY');
  const [orderType, setOrderType] = useState<WasmOrderType>('LIMIT');
  const [priceInput, setPriceInput] = useState<string>('4041.50');
  const [qtyInput, setQtyInput] = useState<string>('1.0');
  const [lastMatchNs, setLastMatchNs] = useState<number>(380);

  useEffect(() => {
    const unsub = wasmMatchingEngine.subscribe((book, lastRep) => {
      setDomBook({ ...book });
      setReports(wasmMatchingEngine.getReports());
      if (lastRep) {
        setLastMatchNs(lastRep.latencyNs);
      }
    });
    return unsub;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(priceInput);
    const q = parseFloat(qtyInput);
    if (isNaN(q) || q <= 0) return;

    const rep = wasmMatchingEngine.submitOrder(
      side,
      orderType,
      isNaN(p) || p <= 0 ? domBook.midPrice : p,
      q
    );
    setLastMatchNs(rep.latencyNs);
  };

  const imbalanceColor =
    domBook.imbalanceRatio > 0.1
      ? 'text-emerald-400'
      : domBook.imbalanceRatio < -0.1
      ? 'text-red-400'
      : 'text-[var(--text-muted)]';

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--accent-cyan)]" />
          <span className="font-bold tracking-wider text-[var(--text-color)] uppercase">
            Wasm-Accelerated Matching Engine & 50-Level DOM
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] text-[10px] font-bold">
            ZERO-ALLOC FIFO
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-[var(--accent-amber)] font-bold">
            <Zap className="w-3.5 h-3.5" />
            {(lastMatchNs / 1000).toFixed(2)} μs Latency
          </span>
          <span className="text-[var(--text-muted)]">
            MicroPrice: <span className="font-bold text-[var(--text-color)]">${domBook.microPrice.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Main Layout: Split into Order Entry + Execution Reports / DOM Depth */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Pane: Order Form & Real-time Execution Reports */}
        <div className="w-full md:w-5/12 border-r border-[var(--border-color)] flex flex-col min-h-0 bg-[var(--surface-color)]">
          {/* Order Placement Form */}
          <form onSubmit={handleSubmit} className="p-3 border-b border-[var(--border-color)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)]">
              <span>ORDER ENTRY CONSOLE</span>
              <span className="text-[10px] text-[var(--accent-cyan)]">Sub-Microsecond Match</span>
            </div>

            {/* Side Switcher */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`py-1.5 rounded font-bold text-center transition-all ${
                  side === 'BUY'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                BUY (BID)
              </button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`py-1.5 rounded font-bold text-center transition-all ${
                  side === 'SELL'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                SELL (ASK)
              </button>
            </div>

            {/* Order Type */}
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {(['LIMIT', 'MARKET', 'IOC', 'FOK', 'POST_ONLY'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={`py-1 rounded font-bold border ${
                    orderType === t
                      ? 'border-[var(--accent-amber)] bg-[var(--accent-amber)]/20 text-[var(--accent-amber)]'
                      : 'border-[var(--border-color)] text-[var(--text-muted)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Price & Lots Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">LIMIT PRICE ($)</label>
                <input
                  type="number"
                  step="0.05"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  disabled={orderType === 'MARKET'}
                  className="w-full px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-xs text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-cyan)]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">LOTS (100 OZ)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded text-xs text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-cyan)]"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-1.5 rounded font-bold text-xs uppercase tracking-wider transition-all ${
                side === 'BUY'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                  : 'bg-red-500 hover:bg-red-400 text-white'
              }`}
            >
              ROUTER EXECUTE {orderType} {side}
            </button>
          </form>

          {/* Execution Reports Log */}
          <div className="flex-1 flex flex-col min-h-0 p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] mb-1.5">
              <span>WASM EXECUTION REPORTS ({reports.length})</span>
              <span className="text-[10px] text-[var(--accent-amber)]">Latency (ns)</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {reports.length === 0 ? (
                <div className="text-center py-6 text-[var(--text-muted)] text-[11px]">
                  No execution reports logged. Submit an order above.
                </div>
              ) : (
                reports.map((rep) => (
                  <div
                    key={rep.execId}
                    className="p-1.5 bg-[var(--surface-elevated)] rounded border border-[var(--border-color)] flex items-center justify-between text-[10px]"
                  >
                    <div className="flex items-center gap-1.5">
                      {rep.execStatus === 'FILLED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : rep.execStatus === 'REJECTED' || rep.execStatus === 'CANCELED' ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          <span className={rep.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                            {rep.side} {rep.cumQty} Lots
                          </span>
                          <span className="text-[var(--text-muted)]">@ ${rep.lastPrice.toFixed(2)}</span>
                        </div>
                        <span className="text-[9px] text-[var(--text-muted)]">{rep.execId}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-amber-400 font-bold block">{rep.latencyNs} ns</span>
                      <span className="text-[9px] text-[var(--text-muted)] uppercase">{rep.execStatus}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: 50-Level Aggregated DOM Depth of Market */}
        <div className="w-full md:w-7/12 flex flex-col min-h-0 bg-[var(--surface-color)] p-3">
          {/* DOM Top Summary */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)] text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-color)]">50-LEVEL L2 DOM BOOK</span>
              <span className="text-[var(--text-muted)]">
                Spread: <span className="text-white font-bold">${domBook.spread.toFixed(2)}</span> ({domBook.spreadBps} bps)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">
                Imbalance: <span className={`font-bold ${imbalanceColor}`}>{(domBook.imbalanceRatio * 100).toFixed(1)}%</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Bids {domBook.bidDepthTotal.toFixed(1)} / Asks {domBook.askDepthTotal.toFixed(1)} oz
              </span>
            </div>
          </div>

          {/* Book Columns: Bids (left) and Asks (right) */}
          <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto mt-2 pr-1">
            {/* Bids */}
            <div className="flex flex-col min-h-0">
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] pb-1 border-b border-[var(--border-color)] uppercase">
                <span>Bid Price</span>
                <span>Size (oz)</span>
                <span>Cum Total</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 mt-1">
                {domBook.bids.map((b) => (
                  <div
                    key={`bid_${b.level}`}
                    className={`relative flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      b.isLiquidityWall ? 'border-l-2 border-emerald-400 bg-emerald-500/10' : ''
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-emerald-500/15 rounded pointer-events-none"
                      style={{ width: `${Math.min(100, b.depthRatio * 100)}%` }}
                    />
                    <span className="relative font-bold text-emerald-400">${b.price.toFixed(2)}</span>
                    <span className="relative text-[var(--text-color)]">{b.amount.toFixed(1)}</span>
                    <span className="relative text-[var(--text-muted)]">{b.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Asks */}
            <div className="flex flex-col min-h-0">
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] pb-1 border-b border-[var(--border-color)] uppercase">
                <span>Ask Price</span>
                <span>Size (oz)</span>
                <span>Cum Total</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 mt-1">
                {domBook.asks.map((a) => (
                  <div
                    key={`ask_${a.level}`}
                    className={`relative flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      a.isLiquidityWall ? 'border-r-2 border-red-400 bg-red-500/10' : ''
                    }`}
                  >
                    <div
                      className="absolute inset-0 bg-red-500/15 rounded pointer-events-none"
                      style={{ width: `${Math.min(100, a.depthRatio * 100)}%` }}
                    />
                    <span className="relative font-bold text-red-400">${a.price.toFixed(2)}</span>
                    <span className="relative text-[var(--text-color)]">{a.amount.toFixed(1)}</span>
                    <span className="relative text-[var(--text-muted)]">{a.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
