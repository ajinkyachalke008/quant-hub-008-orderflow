import React, { useRef, useEffect, useMemo } from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { NormalizedTrade, FootprintCandle, FeedState } from '../../types/orderFlow';

const TICK_SIZE = 0.10;
const TIMEFRAME_MS = 60_000;

function deriveFootprint(trades: NormalizedTrade[]): FootprintCandle[] {
  const map = new Map<number, Map<number, { buyVol: number; sellVol: number }>>();
  for (const t of trades) {
    const row = Math.floor(t.price / TICK_SIZE);
    const bucket = Math.floor(t.timestamp / TIMEFRAME_MS) * TIMEFRAME_MS;
    if (!map.has(bucket)) map.set(bucket, new Map());
    const rows = map.get(bucket)!;
    if (!rows.has(row)) rows.set(row, { buyVol: 0, sellVol: 0 });
    const cell = rows.get(row)!;
    if (t.side === 'buy') cell.buyVol += t.qty;
    else cell.sellVol += t.qty;
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, rows]) => ({
      t,
      cells: [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([row, v]) => ({ row, sellVol: v.sellVol, buyVol: v.buyVol })),
    }));
}

export function FootprintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const { trades, depth, feedStates } = useOrderFlowStore();

  const footprint = useMemo(() => deriveFootprint(trades), [trades]);
  const priceMin = useMemo(() => depth?.bids[depth.bids.length - 1]?.price ?? 0, [depth]);
  const priceMax = useMemo(() => depth?.asks[0]?.price ?? 0, [depth]);
  const isLoading = trades.length === 0 && !depth;

  const render = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, w, h);

    if (footprint.length === 0 || priceMax <= priceMin) return;

    const rowH = 12;
    const candleW = Math.max(2, w / Math.max(1, footprint.length));
    const priceSpan = priceMax - priceMin;

    for (let i = 0; i < footprint.length; i++) {
      const candle = footprint[i];
      const x = i * candleW;
      for (const cell of candle.cells) {
        const price = cell.row * TICK_SIZE;
        const y = (1 - (price - priceMin) / priceSpan) * h;
        const total = cell.buyVol + cell.sellVol;
        if (total === 0) continue;
        const barH = Math.max(1, rowH * 0.8);
        const buyRatio = cell.buyVol / total;
        ctx.fillStyle = 'var(--ot-profit)';
        ctx.fillRect(x, y, candleW * buyRatio, barH);
        ctx.fillStyle = 'var(--ot-loss)';
        ctx.fillRect(x + candleW * buyRatio, y, candleW * (1 - buyRatio), barH);
      }
    }

    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'var(--ot-text-muted)';
    ctx.fillText('FOOTPRINT', 8, 14);

    const feeds = Object.entries(feedStates);
    if (feeds.length) {
      const live = feeds.some(([, s]) => s === 'LIVE');
      ctx.fillStyle = live ? 'var(--ot-profit)' : 'var(--ot-amber)';
      ctx.fillText(live ? '\u25cf LIVE' : '\u25cf DELAYED', w - 70, 14);
    }
  }, [footprint, priceMin, priceMax, feedStates]);

  useEffect(() => {
    let raf: number;
    const loop = () => { render(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [render]);

  if (isLoading) {
    return (
      <div className="ot-skeleton" style={{ width: '100%', height: 200, background: 'var(--ot-bg-panel)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--ot-bg-surface) 25%, var(--ot-border) 50%, var(--ot-bg-surface) 75%)', backgroundSize: '200% 100%', animation: 'ot-shimmer 1.5s infinite' }} />
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height: 200, display: 'block' }} />;
}
