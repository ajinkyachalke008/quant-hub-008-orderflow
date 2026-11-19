import { useEffect, useRef, useMemo } from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { HeatmapRenderer } from '../../lib/orderflow/heatmapRenderer';
import type { FeedState } from '../../types/orderFlow';

export function HeatmapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeatmapRenderer | null>(null);
  const columns = useOrderFlowStore((s) => s.heatmapColumns);
  const depth = useOrderFlowStore((s) => s.depth);
  const feedStates = useOrderFlowStore((s) => s.feedStates);

  const priceRange = useMemo(() => {
    if (!depth || depth.bids.length === 0 || depth.asks.length === 0) {
      return { min: 0, max: 1 };
    }
    const all = [...depth.bids.map((b) => b.price), ...depth.asks.map((a) => a.price)];
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [depth]);

  const feedState: FeedState =
    (feedStates['heatmap'] as FeedState) || (feedStates['depth'] as FeedState) || 'CONNECTING';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!rendererRef.current) rendererRef.current = new HeatmapRenderer(canvas);
    const renderer = rendererRef.current;
    let raf = 0;

    const draw = () => {
      const w = canvas.clientWidth || 600;
      const h = canvas.clientHeight || 300;
      const dpi = window.devicePixelRatio || 1;
      renderer.resize(w, h, dpi);
      renderer.render({
        canvas,
        columns,
        priceMin: priceRange.min,
        priceMax: priceRange.max,
        width: w,
        height: h,
        dpi,
      });
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [columns, priceRange]);

  const loading = columns.length === 0;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'var(--ot-bg-panel)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      <span
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          color: 'var(--ot-text-primary)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}
      >
        LIQUIDITY HEATMAP
      </span>

      <span
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          color:
            feedState === 'LIVE'
              ? 'var(--ot-profit)'
              : feedState === 'CONNECTING' || feedState === 'RECONNECTING'
                ? 'var(--ot-amber)'
                : 'var(--ot-loss)',
          fontSize: 11,
          fontWeight: 700,
          background: 'var(--ot-bg-surface)',
          border: '1px solid var(--ot-border)',
          padding: '2px 6px',
          borderRadius: '3px',
        }}
      >
        {feedState}
      </span>

      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--ot-bg-panel)',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ot-text-muted)',
            fontSize: 12,
            letterSpacing: '1px',
          }}
        >
          AWAITING HEATMAP DATA...
        </div>
      )}
    </div>
  );
}

export default HeatmapCanvas;
