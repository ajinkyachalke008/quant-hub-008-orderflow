import React from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { Coins, Flame, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const CryptoWidget: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();
  const [cryptoAssets, setCryptoAssets] = React.useState([
    { symbol: 'BTC', name: 'Bitcoin', price: '$78,496.00', change: '+1.91%', isPos: true, cap: '$1.55T', vol: '$32.4B' },
    { symbol: 'ETH', name: 'Ethereum', price: '$2,540.80', change: '+1.93%', isPos: true, cap: '$305.8B', vol: '$14.2B' },
    { symbol: 'SOL', name: 'Solana', price: '$178.60', change: '+4.63%', isPos: true, cap: '$83.9B', vol: '$4.1B' },
    { symbol: 'BNB', name: 'BNB Chain', price: '$598.20', change: '+0.84%', isPos: true, cap: '$87.1B', vol: '$1.8B' },
    { symbol: 'XRP', name: 'XRP Ledger', price: '$0.524', change: '-1.15%', isPos: false, cap: '$29.7B', vol: '$1.1B' },
    { symbol: 'AVAX', name: 'Avalanche', price: '$27.80', change: '+3.20%', isPos: true, cap: '$11.2B', vol: '$650M' },
  ]);

  React.useEffect(() => {
    const loadRealCrypto = async () => {
      try {
        const resp = await fetch('/api/crypto');
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setCryptoAssets(data);
          }
        }
      } catch (_) {}
    };
    loadRealCrypto();
    const interval = setInterval(loadRealCrypto, 10000);
    return () => clearInterval(interval);
  }, []);

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
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            CRYPTO BOARD
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-xs font-mono text-slate-400">24/7 SPOT</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
          <Flame className="w-3 h-3" />
          <span>DOMINANCE: 58.2%</span>
        </div>
      </div>

      {/* Crypto Grid */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--ot-border)' }}>
        {cryptoAssets.map((asset) => {
          const isActive = asset.symbol === activeSymbol;
          return (
            <div
              key={asset.symbol}
              onClick={() => setActiveSymbol(asset.symbol)}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                isActive ? 'border-l-2' : 'hover:bg-slate-800/30'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--ot-bg-hover)' : 'transparent',
                borderColor: isActive ? 'var(--ot-cyan)' : 'var(--ot-border)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs font-mono border"
                  style={{
                    borderColor: 'var(--ot-border)',
                    backgroundColor: 'var(--ot-bg-surface)',
                    color: 'var(--ot-amber)',
                  }}
                >
                  {asset.symbol.slice(0, 3)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold font-mono text-slate-100">{asset.symbol}</span>
                  <span className="text-[10px] text-slate-400">{asset.name}</span>
                </div>
              </div>

              <div className="text-right font-mono tabular-nums">
                <div className="text-xs font-bold text-slate-100">{asset.price}</div>
                <div
                  className="text-[11px] font-semibold flex items-center justify-end gap-0.5"
                  style={{ color: asset.isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                >
                  {asset.isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{asset.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
