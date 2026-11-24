import React, { useState, useEffect, useRef } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { GripHorizontal, X, Minimize2, Maximize2, Coins, WifiOff } from 'lucide-react';

export interface CryptoTickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

export const CryptoTicker: React.FC = () => {
  const { setActiveSymbol, activeSymbol } = useTerminal();
  const [items, setItems] = useState<Record<string, CryptoTickerItem>>({});
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const prevPricesRef = useRef<Record<string, number>>({});

  const refreshPrices = async () => {
    try {
      const resp = await fetch('/api/crypto');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          setItems((prev) => {
            const next = { ...prev };
            data.forEach((d) => {
              if (['BTC', 'ETH', 'SOL'].includes(d.symbol)) {
                const numericPrice = parseFloat(d.price.replace(/[^0-9.-]+/g, '')) || prev[d.symbol]?.price;
                const numericChange = parseFloat(d.change.replace(/[^0-9.-]+/g, '')) || 0;
                const prevSparkline = prev[d.symbol]?.sparkline || [];
                const newSparkline = [...prevSparkline.slice(1), numericPrice].slice(-30);
                next[d.symbol] = {
                  symbol: d.symbol,
                  name: d.name,
                  price: numericPrice,
                  change: +(numericPrice * (numericChange / 100)).toFixed(2),
                  changePercent: numericChange,
                  sparkline: newSparkline,
                };
              }
            });
            return next;
          });
          setIsOnline(true);
          return;
        }
      }
    } catch (_) {}

    setIsOnline(false);
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

  const renderSparkline = (data: number[], isPositive: boolean) => {
    if (data.length < 2) return null;
    const width = 70;
    const height = 24;
    const padding = 2;
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;
    const points = data.map((val: number, i: number) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
      return x + ',' + y;
    }).join(' ');
    const color = isPositive ? 'var(--ot-profit)' : 'var(--ot-loss)';
    return (
      <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} style={{ flexShrink: 0 }}>
        <polyline
          fill='none'
          stroke={color}
          strokeWidth='1.2'
          strokeLinecap='round'
          strokeLinejoin='round'
          points={points}
          style={{ filter: 'drop-shadow(0 0 2px ' + color + ')' }}
        />
      </svg>
    );
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  };

  return (
    <div
      style={{
        transform: 'translate3d(' + position.x + 'px, ' + position.y + 'px, 0)',
        position: 'fixed',
        zIndex: 40,
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
      className='w-80 rounded-lg border shadow-2xl overflow-hidden select-none'
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className='flex items-center justify-between px-3 py-2 border-b cursor-move'
        style={{
          borderColor: 'var(--ot-border)',
          backgroundColor: 'var(--ot-bg-surface)',
        }}
      >
        <div className='flex items-center gap-2'>
          <GripHorizontal className='w-4 h-4' style={{ color: 'var(--ot-text-muted)' }} />
          <Coins className='w-3.5 h-3.5' style={{ color: 'var(--ot-amber)' }} />
          <span className='text-xs font-bold tracking-wide' style={{ color: 'var(--ot-amber)' }}>
            CRYPTO TICKER
          </span>
          <span
            className='text-[9px] font-mono px-1.5 py-0.2 rounded border flex items-center gap-1'
            style={{
              borderColor: 'var(--ot-border)',
              color: isOnline ? 'var(--ot-profit)' : 'var(--ot-loss)',
              backgroundColor: isOnline ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            }}
          >
            {isOnline ? (
              <>
                <span
                  className='w-1.5 h-1.5 rounded-full animate-pulse'
                  style={{ backgroundColor: 'var(--ot-profit)', boxShadow: '0 0 4px var(--ot-profit)' }}
                />
                LIVE
              </>
            ) : (
              <>
                <WifiOff className='w-2.5 h-2.5' />
                OFFLINE
              </>
            )}
          </span>
        </div>

        <div className='flex items-center gap-1.5'>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className='p-1 rounded' style={{ color: 'var(--ot-text-muted)' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--ot-text-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--ot-text-muted)'}
          >
            {isMinimized ? <Maximize2 className='w-3 h-3' /> : <Minimize2 className='w-3 h-3' />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className='p-2 space-y-1' style={{ borderColor: 'var(--ot-border)' }}>
          {!isOnline && Object.keys(items).length === 0 ? (
            <div className='flex flex-col items-center justify-center py-6 gap-2 text-center'>
              <WifiOff className='w-8 h-8' style={{ color: 'var(--ot-loss)' }} />
              <span className='text-xs font-mono' style={{ color: 'var(--ot-text-muted)' }}>OFFLINE</span>
              <span className='text-[10px] px-3' style={{ color: 'var(--ot-text-muted)' }}>retrying every 6s...</span>
            </div>
          ) : (
            majorTickers.map((sym) => {
              const item = items[sym];
              if (!item) return null;
              const isPos = item.changePercent >= 0;
              const isActive = sym === activeSymbol;
              const prevPrice = prevPricesRef.current[sym];
              const priceChanged = prevPrice !== undefined && prevPrice !== item.price;
              const priceDirection = priceChanged ? (item.price > prevPrice ? 'up' : 'down') : null;

              if (priceChanged) {
                prevPricesRef.current[sym] = item.price;
              } else if (prevPrice === undefined) {
                prevPricesRef.current[sym] = item.price;
              }

              return (
                <div
                  key={sym}
                  onClick={() => setActiveSymbol(sym)}
                  className={'flex items-center justify-between p-2 rounded cursor-pointer transition-colors relative overflow-hidden ' + (isActive ? 'bg-slate-800/40 border-l-2' : 'hover:bg-slate-800/20')}
                  style={{
                    borderColor: isActive ? 'var(--ot-cyan)' : 'transparent',
                    borderBottom: '1px solid var(--ot-border)',
                  }}
                >
                  <div className='flex items-center gap-2 min-w-0 flex-1'>
                    <div
                      className='w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] font-mono border flex-shrink-0'
                      style={{
                        borderColor: 'var(--ot-border)',
                        backgroundColor: 'var(--ot-bg-surface)',
                        color: 'var(--ot-amber)',
                      }}
                    >
                      {sym}
                    </div>
                    <div className='flex flex-col min-w-0'>
                      <span className='text-xs font-bold truncate' style={{ color: 'var(--ot-text-primary)' }}>
                        {item.symbol}
                      </span>
                      <span className='text-[10px] truncate' style={{ color: 'var(--ot-text-muted)' }}>
                        {item.name}
                      </span>
                    </div>
                  </div>

                  <div className='flex items-center gap-3 ml-2'>
                    <div className='text-right font-mono tabular-nums'>
                      <div
                        className='text-xs font-bold transition-all duration-150'
                        style={{
                          color: 'var(--ot-text-primary)',
                          backgroundColor: priceDirection === 'up' ? 'rgba(0, 230, 118, 0.15)' :
                                         priceDirection === 'down' ? 'rgba(255, 59, 48, 0.15)' : 'transparent',
                          borderRadius: '2px',
                          padding: '1px 3px',
                        }}
                      >
                        {'$' + formatPrice(item.price)}
                      </div>
                      <div
                        className='text-[10px] font-semibold'
                        style={{ color: isPos ? 'var(--ot-profit)' : 'var(--ot-loss)' }}
                      >
                        {isPos ? '▲ ' : '▼ '}
                        {Math.abs(item.changePercent).toFixed(2)}%
                      </div>
                    </div>

                    {renderSparkline(item.sparkline, isPos)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};