import React, { useState, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { GripHorizontal, RefreshCw, X, Minimize2, Maximize2, Coins, TrendingUp } from 'lucide-react';

export interface CryptoTickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  sparkline: number[];
}

/**
 * Mock Data Provider interface for major crypto assets
 */
export const mockCryptoDataProvider = {
  fetchInitial: (): Record<string, CryptoTickerItem> => ({
    BTC: {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 78456.00,
      change: 1450.00,
      changePercent: 1.89,
      high24h: 79120.00,
      low24h: 76800.00,
      sparkline: [76900, 77200, 77600, 77400, 78100, 78456],
    },
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      price: 2322.00,
      change: 54.40,
      changePercent: 2.40,
      high24h: 2365.00,
      low24h: 2260.00,
      sparkline: [2270, 2285, 2300, 2295, 2315, 2322],
    },
    SOL: {
      symbol: 'SOL',
      name: 'Solana',
      price: 93.19,
      change: 0.90,
      changePercent: 0.97,
      high24h: 95.40,
      low24h: 91.80,
      sparkline: [91.9, 92.4, 92.8, 92.5, 93.0, 93.19],
    },
  }),
};

export const CryptoTicker: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();
  const [items, setItems] = useState<Record<string, CryptoTickerItem>>(mockCryptoDataProvider.fetchInitial());
  const [isMinimized, setIsMinimized] = useState(false);
  const [providerMode, setProviderMode] = useState<'LIVE' | 'MOCK'>('LIVE');
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fetch real data with fallback to mock data provider
  const refreshPrices = async () => {
    try {
      const resp = await fetch('/api/crypto');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          setItems((prev) => {
            const next = { ...prev };
            data.forEach((d: any) => {
              if (['BTC', 'ETH', 'SOL'].includes(d.symbol)) {
                const numericPrice = parseFloat(d.price.replace(/[^0-9.-]+/g, '')) || prev[d.symbol]?.price;
                const numericChange = parseFloat(d.change.replace(/[^0-9.-]+/g, '')) || 0;
                next[d.symbol] = {
                  symbol: d.symbol,
                  name: d.name,
                  price: numericPrice,
                  change: +(numericPrice * (numericChange / 100)).toFixed(2),
                  changePercent: numericChange,
                  high24h: +(numericPrice * 1.02).toFixed(2),
                  low24h: +(numericPrice * 0.98).toFixed(2),
                  sparkline: [...(prev[d.symbol]?.sparkline.slice(1) || []), numericPrice],
                };
              }
            });
            return next;
          });
          setProviderMode('LIVE');
          return;
        }
      }
    } catch (_) {}

    // Fallback to mock data provider if network is offline
    setProviderMode('MOCK');
  };

  useEffect(() => {
    refreshPrices();
    const interval = setInterval(refreshPrices, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x)),
        y: Math.max(10, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const majorTickers = ['BTC', 'ETH', 'SOL'];

  return (
    <div
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        position: 'fixed',
        zIndex: 40,
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
      className="w-80 rounded-lg border shadow-2xl overflow-hidden select-none"
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3 py-2 border-b cursor-move"
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
        }}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-400" />
          <Coins className="w-3.5 h-3.5" style={{ color: 'var(--ot-amber)' }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--ot-amber)' }}>
            CRYPTO TICKER
          </span>
          <span
            className="text-[9px] font-mono px-1 py-0.2 rounded border"
            style={{
              borderColor: 'var(--ot-border)',
              color: providerMode === 'LIVE' ? 'var(--ot-profit)' : 'var(--ot-cyan)',
            }}
          >
            {providerMode}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-slate-400 hover:text-slate-100"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="p-2 space-y-1 divide-y" style={{ borderColor: 'var(--ot-border)' }}>
          {majorTickers.map((sym) => {
            const item = items[sym];
            if (!item) return null;
            const isPos = item.changePercent >= 0;
            const isActive = sym === activeSymbol;

            return (
              <div
                key={sym}
                onClick={() => setActiveSymbol(sym)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  isActive ? 'bg-slate-800/40 border-l-2' : 'hover:bg-slate-800/20'
                }`}
                style={{
                  borderColor: isActive ? 'var(--ot-cyan)' : 'transparent',
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] font-mono border"
                    style={{
                      borderColor: 'var(--ot-border)',
                      backgroundColor: 'var(--ot-bg-surface)',
                      color: 'var(--ot-amber)',
                    }}
                  >
                    {sym}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-100">{item.symbol}</span>
                    <span className="text-[10px] text-slate-400">{item.name}</span>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums">
                  <div className="text-xs font-bold text-slate-100">
                    ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div
                    className="text-[10px] font-semibold"
                    style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                  >
                    {isPos ? '+' : ''}
                    {item.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
