import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { useOrderFlowStore } from '../../stores/orderFlowStore';

export const OHLCVChart: React.FC = () => {
  const trades = useOrderFlowStore((s) => s.trades);
  const feedStates = useOrderFlowStore((s) => s.feedStates);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || trades.length === 0) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
      layout: { background: { color: 'transparent' }, textColor: 'var(--ot-text-primary)' },
      grid: { vertLines: { color: 'var(--ot-border)' }, horzLines: { color: 'var(--ot-border)' } },
    });

    const candles = new Map<number, { open: number; high: number; low: number; close: number; volume: number; takerBuy: number }>();
    let vwapNum = 0, vwapDen = 0;
    for (const t of [...trades].reverse()) {
      const bucket = Math.floor(t.timestamp / 60000) * 60;
      const c = candles.get(bucket) ?? { open: t.price, high: t.price, low: t.price, close: t.price, volume: 0, takerBuy: 0 };
      c.high = Math.max(c.high, t.price);
      c.low = Math.min(c.low, t.price);
      c.close = t.price;
      c.volume += t.qty;
      if (t.side === 'buy') c.takerBuy += t.qty;
      candles.set(bucket, c);
      vwapNum += t.price * t.qty;
      vwapDen += t.qty;
    }

    const cs = chart.addSeries(CandlestickSeries, { upColor: 'var(--ot-profit)', downColor: 'var(--ot-loss)', borderVisible: false, wickUpColor: 'var(--ot-profit)', wickDownColor: 'var(--ot-loss)' });
    const vwap = chart.addSeries(LineSeries, { color: 'var(--ot-amber)', lineWidth: 2 });
    const cvd = chart.addSeries(HistogramSeries, { color: 'var(--ot-cyan)' });

    const sorted = [...candles.entries()].sort((a, b) => a[0] - b[0]);
    cs.setData(sorted.map(([time, c]) => ({ time: time as any, open: c.open, high: c.high, low: c.low, close: c.close })));
    vwap.setData(sorted.map(([time]) => ({ time: time as any, value: vwapDen ? vwapNum / vwapDen : 0 })));
    let runningCvd = 0;
    cvd.setData(sorted.map(([time, c]) => {
      runningCvd += c.takerBuy - (c.volume - c.takerBuy);
      return { time: time as any, value: runningCvd, color: runningCvd >= 0 ? 'var(--ot-profit)' : 'var(--ot-loss)' };
    }));

    const onResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth ?? 0 });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [trades]);

  const feedOk = Object.values(feedStates).every((v) => v === 'CONNECTED' || v === 'LIVE');

  if (trades.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', color: 'var(--ot-text-primary)', padding: 12, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--ot-text-muted)' }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--ot-bg-panel)', border: '1px solid var(--ot-border)', color: 'var(--ot-text-primary)', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--ot-accent)' }}>OHLCV + VWAP + CVD</span>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: feedOk ? 'var(--ot-profit)' : 'var(--ot-amber)', color: 'var(--ot-bg-panel)' }}>{feedOk ? 'LIVE' : 'CONNECTING'}</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 260 }} />
    </div>
  );
};
