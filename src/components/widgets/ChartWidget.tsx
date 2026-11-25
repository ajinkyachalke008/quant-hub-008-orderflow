import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTerminal } from '../../context/TerminalContext';
import { ChartStyle, OverlayIndicator, PivotType, SubPaneIndicator, Timeframe, PaperPosition, PaperOrder } from '../../types/terminal';
import { calculateFibonacciLevels, calculatePivotPoints } from '../../services/technicalAnalysis';
import { VolumeProfileEngine } from '../../services/volumeProfileEngine';
import { paperTradingEngine } from '../../services/paperTradingEngine';
import { Layers } from 'lucide-react';

interface ChartWidgetProps {
  customTimeframe?: Timeframe;
  syncHoverIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  paneTitle?: string;
  showCompactControls?: boolean;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  customTimeframe,
  syncHoverIndex,
  onHoverChange,
  paneTitle,
  showCompactControls,
}) => {
  const {
    activeSymbol,
    activeQuote,
    candles: globalCandles,
    timeframe: globalTimeframe,
    setTimeframe: setGlobalTimeframe,
    chartStyle,
    setChartStyle,
    overlayIndicators,
    toggleOverlayIndicator,
    subPaneIndicator,
    setSubPaneIndicator,
    fibonacciEnabled,
    setFibonacciEnabled,
    pivotType,
    setPivotType,
  } = useTerminal();

  const [localTimeframe, setLocalTimeframe] = useState<Timeframe>(customTimeframe || globalTimeframe);
  const [localCandles, setLocalCandles] = useState<any[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const activeTimeframe = localTimeframe;
  const candles = localCandles.length > 0 ? localCandles : globalCandles;

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [vpvrEnabled, setVpvrEnabled] = useState<boolean>(true);
  const [sessionsEnabled, setSessionsEnabled] = useState<boolean>(true);
  const [activePositions, setActivePositions] = useState<PaperPosition[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PaperOrder[]>([]);

  // Feature 3: log/linear scale toggle
  const [logScale, setLogScale] = useState(false);

  // Feature 4: pan / zoom state
  const [visibleCount, setVisibleCount] = useState<number>(120);
  const [offset, setOffset] = useState<number>(0);
  const prevTimeframeRef = useRef<Timeframe | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const dragStartCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setCandlesLoading(true);
    import('../../services/marketData').then(({ fetchLiveCandles }) => {
      fetchLiveCandles(activeSymbol, activeTimeframe).then((cs: any) => {
        if (!cancelled) { setLocalCandles(cs || []); setCandlesLoading(false); }
      }).catch(() => { if (!cancelled) setCandlesLoading(false); });
    });
    return () => { cancelled = true; };
  }, [activeSymbol, activeTimeframe]);

  // Reset pan/zoom to show latest candles on first load or timeframe change
  useEffect(() => {
    if (candles.length === 0) return;
    const prev = prevTimeframeRef.current;
    const firstLoad = prev === null;
    const tfChanged = prev !== null && prev !== activeTimeframe;
    if (firstLoad || tfChanged) {
      prevTimeframeRef.current = activeTimeframe;
      const vc = Math.min(120, candles.length);
      setVisibleCount(vc);
      setOffset(Math.max(0, candles.length - vc));
    }
  }, [activeTimeframe, candles.length]);

  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveHoverIndex = syncHoverIndex !== undefined && syncHoverIndex !== null ? syncHoverIndex : hoverIndex;

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];
  const chartStyles: ChartStyle[] = ['candle', 'bar', 'line', 'area'];

  // Subscribe to paper trading positions and orders to render chart levels
  useEffect(() => {
    const unsub = paperTradingEngine.subscribe((state) => {
      setActivePositions(state.positions.filter((p) => p.symbol === activeSymbol));
      setPendingOrders(state.orders.filter((o) => o.symbol === activeSymbol && o.status === 'pending'));
    });
    return unsub;
  }, [activeSymbol]);

  // --- Pan / zoom derivation (operates on the visible slice) ---
  const effCount = Math.max(1, Math.min(visibleCount, candles.length || 1));
  const maxOffset = Math.max(0, (candles.length || 1) - effCount);
  const off = Math.max(0, Math.min(offset, maxOffset));
  const visCandles = candles.slice(off, off + effCount);
  const visLen = visCandles.length;

  // Min / max price over the VISIBLE slice (rescales vertically on zoom)
  const { minPrice: visMinPrice, maxPrice: visMaxPrice, maxVol: visMaxVol } = useMemo(() => {
    const src = visLen ? visCandles : candles;
    if (!src.length) return { minPrice: 0, maxPrice: 100, maxVol: 1000 };
    let min = Infinity;
    let max = -Infinity;
    let maxV = 0;
    src.forEach((c) => {
      min = Math.min(min, c.low, c.lowerBand ?? min);
      max = Math.max(max, c.high, c.upperBand ?? max);
      maxV = Math.max(maxV, c.volume);
    });
    const buffer = (max - min) * 0.05;
    return {
      minPrice: Math.max(0, min - buffer),
      maxPrice: max + buffer,
      maxVol: maxV * 1.15,
    };
  }, [visCandles, candles]);

  const activeCandle =
    effectiveHoverIndex !== null && candles[effectiveHoverIndex]
      ? candles[effectiveHoverIndex]
      : candles[candles.length - 1];

  // SVG dimensions
  const svgWidth = 860;
  const isSubPaneActive = subPaneIndicator !== null;
  const totalHeight = 420;
  const pricePlotHeight = isSubPaneActive ? 250 : 330;
  const subPlotTop = 280;
  const subPlotHeight = 110;
  const rightAxisWidth = 85;
  const chartWidth = svgWidth - rightAxisWidth;

  // Feature 1 & 3: price -> pixel (log-aware), over visible price range
  const getY = (val: number) => {
    if (visMaxPrice === visMinPrice) return pricePlotHeight / 2;
    if (logScale) {
      if (val <= 0 || visMinPrice <= 0 || visMaxPrice <= 0) {
        return pricePlotHeight - ((val - visMinPrice) / (visMaxPrice - visMinPrice)) * pricePlotHeight;
      }
      return ((Math.log(visMaxPrice) - Math.log(val)) / (Math.log(visMaxPrice) - Math.log(visMinPrice))) * pricePlotHeight;
    }
    return pricePlotHeight - ((val - visMinPrice) / (visMaxPrice - visMinPrice)) * pricePlotHeight;
  };

  const stepX = visLen > 1 ? chartWidth / (visLen - 1) : chartWidth;

  // Volume Profile Visible Range (VPVR) Calculation
  const volumeProfile = useMemo(() => {
    if (!vpvrEnabled || !candles.length) return null;
    return VolumeProfileEngine.calculateVPVR(candles, 40);
  }, [candles, vpvrEnabled]);

  // Session Liquidity Levels (PDH / PDL / Asian / London sweeps)
  const sessionLiquidity = useMemo(() => {
    if (!sessionsEnabled || !candles.length) return null;
    return VolumeProfileEngine.calculateSessionLiquidity(candles);
  }, [candles, sessionsEnabled]);

  // Auto-Fibonacci levels
  const fibLevels = useMemo(() => {
    if (!fibonacciEnabled) return [];
    return calculateFibonacciLevels(candles);
  }, [candles, fibonacciEnabled]);

  // Pivot Points
  const pivotPoints = useMemo(() => {
    if (pivotType === 'off' || candles.length < 2) return null;
    const prior = candles[candles.length - 2];
    return calculatePivotPoints(prior.high, prior.low, prior.close, pivotType);
  }, [candles, pivotType]);

  // EMA helper (used for MACD)
  const emaArray = (values: number[], period: number) => {
    const out: (number | null)[] = Array(values.length).fill(null);
    if (!values.length) return out;
    const alpha = 2 / (period + 1);
    let ema: number | null = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null || Number.isNaN(v)) { ema = null; continue; }
      if (ema === null) ema = v;
      else ema = alpha * v + (1 - alpha) * ema;
      out[i] = ema;
    }
    return out;
  };

  // Feature 5: MACD (12/26/9) computed from visible closes
  const macdData = useMemo(() => {
    if (!visLen) return [];
    const closes = visCandles.map((c) => c.close);
    const ema12 = emaArray(closes, 12);
    const ema26 = emaArray(closes, 26);
    const macdLine = closes.map((_, i) => {
      const a = ema12[i], b = ema26[i];
      return a == null || b == null ? null : a - b;
    });
    const signalLine: (number | null)[] = [];
    let prev: number | null = null;
    macdLine.forEach((m) => {
      if (m == null) { signalLine.push(null); prev = null; }
      else {
        if (prev == null) prev = m;
        else prev = 0.2 * m + 0.8 * prev;
        signalLine.push(prev);
      }
    });
    return visCandles.map((_, i) => ({
      macd: macdLine[i],
      signal: signalLine[i],
      histogram: (macdLine[i] == null || signalLine[i] == null) ? null : macdLine[i]! - signalLine[i]!,
    }));
  }, [visCandles]);

  const macdBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    macdData.forEach((d) => {
      [d.macd, d.signal].forEach((v) => { if (v != null) { min = Math.min(min, v); max = Math.max(max, v); } });
    });
    min = Math.min(min, 0);
    max = Math.max(max, 0);
    if (min === Infinity) return { min: 0, max: 1 };
    if (max === min) { min -= 1; max += 1; }
    const pad = (max - min) * 0.15;
    return { min: min - pad, max: max + pad };
  }, [macdData]);

  const macdValY = (v: number) => subPlotHeight - ((v - macdBounds.min) / (macdBounds.max - macdBounds.min)) * subPlotHeight;
  const macdZeroY = macdValY(0);

  // Feature 6: 20-period volume moving average over visible slice
  const volSma20 = useMemo(() => {
    const out: (number | null)[] = Array(visLen).fill(null);
    for (let i = 19; i < visLen; i++) {
      let sum = 0;
      for (let k = 0; k < 20; k++) sum += visCandles[i - k].volume || 0;
      out[i] = sum / 20;
    }
    return out;
  }, [visCandles]);

  let volMaPath = '';
  { let started = false;
    volSma20.forEach((v, i) => {
      if (v == null) return;
      const x = i * stepX;
      const y = pricePlotHeight - (v / visMaxVol) * (pricePlotHeight * 0.16);
      if (!started) { volMaPath = `M ${x} ${y}`; started = true; }
      else volMaPath += ` L ${x} ${y}`;
    });
  }

  // Generate SVG path for line/area chart (over visible slice)
  const linePath = useMemo(() => {
    if (!visLen) return '';
    return visCandles.reduce((acc, c, j) => {
      const x = j * stepX;
      const y = getY(c.close);
      return j === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [visCandles, stepX, visMinPrice, visMaxPrice]);

  const createPathFromKey = (key: keyof typeof candles[0]) => {
    let started = false;
    let path = '';
    visCandles.forEach((c, j) => {
      const val = c[key] as number | undefined;
      if (val === undefined || isNaN(val)) return;
      const x = j * stepX;
      const y = getY(val);
      if (!started) {
        path += `M ${x} ${y}`;
        started = true;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    return path;
  };

  const sma20Path = overlayIndicators.includes('sma20') ? createPathFromKey('sma20') : '';
  const sma50Path = overlayIndicators.includes('sma50') ? createPathFromKey('sma50') : '';
  const sma200Path = overlayIndicators.includes('sma200') ? createPathFromKey('sma200') : '';
  const ema9Path = overlayIndicators.includes('ema9') ? createPathFromKey('ema9') : '';
  const ema21Path = overlayIndicators.includes('ema21') ? createPathFromKey('ema21') : '';
  const vwapPath = overlayIndicators.includes('vwap') ? createPathFromKey('vwap') : '';
  const upperBollPath = overlayIndicators.includes('bb') ? createPathFromKey('upperBand') : '';
  const lowerBollPath = overlayIndicators.includes('bb') ? createPathFromKey('lowerBand') : '';

  // Phase II: Advanced Indicator Paths
  const tenkanPath = overlayIndicators.includes('ichimoku') ? createPathFromKey('tenkan') : '';
  const kijunPath = overlayIndicators.includes('ichimoku') ? createPathFromKey('kijun') : '';
  const senkouAPath = overlayIndicators.includes('ichimoku') ? createPathFromKey('senkouA') : '';
  const senkouBPath = overlayIndicators.includes('ichimoku') ? createPathFromKey('senkouB') : '';
  const vwapSd1UpperPath = overlayIndicators.includes('vwap_bands') ? createPathFromKey('vwapSd1Upper') : '';
  const vwapSd1LowerPath = overlayIndicators.includes('vwap_bands') ? createPathFromKey('vwapSd1Lower') : '';
  const vwapSd2UpperPath = overlayIndicators.includes('vwap_bands') ? createPathFromKey('vwapSd2Upper') : '';
  const vwapSd2LowerPath = overlayIndicators.includes('vwap_bands') ? createPathFromKey('vwapSd2Lower') : '';
  const donchianUpperPath = overlayIndicators.includes('donchian') ? createPathFromKey('donchianUpper') : '';
  const donchianLowerPath = overlayIndicators.includes('donchian') ? createPathFromKey('donchianLower') : '';
  const donchianMidPath = overlayIndicators.includes('donchian') ? createPathFromKey('donchianMiddle') : '';

  // Feature 2: last-candle close countdown timer
  const timeframeSeconds: Record<Timeframe, number> = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000, 'ALL': 0,
  };
  const intervalSeconds = timeframeSeconds[activeTimeframe];
  const lastCandle = candles[candles.length - 1];
  const lastClose = lastCandle?.close ?? 0;
  const lastOpen = lastCandle?.open ?? 0;
  const lastTimestamp = lastCandle?.timestamp ?? 0;
  const closeTime = lastTimestamp ? lastTimestamp + intervalSeconds * 1000 : 0;
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const lastCandleRef = useRef(lastCandle);
  lastCandleRef.current = lastCandle;

  const formatRemaining = (sec: number) => {
    if (sec <= 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (intervalSeconds <= 0 || !lastCandle) { setSecondsRemaining(0); return; }
    const tick = () => {
      const lc = lastCandleRef.current;
      const ct = lc?.timestamp ? lc.timestamp + intervalSeconds * 1000 : 0;
      let rem = ct - Date.now();
      if (rem < 0) rem = 0;
      setSecondsRemaining(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intervalSeconds]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || !candles.length) return;
    if (isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * svgWidth;
    const ratio = Math.max(0, Math.min(1, svgX / chartWidth));
    const localIdx = Math.round(ratio * Math.max(0, visLen - 1));
    const safeIndex = Math.max(0, Math.min(candles.length - 1, off + localIdx));
    setHoverIndex(safeIndex);
    if (onHoverChange) {
      onHoverChange(safeIndex);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    if (onHoverChange) {
      onHoverChange(null);
    }
  };

  // Feature 4: wheel zoom + drag pan + double-click reset
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!candles.length) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = (e.nativeEvent.clientX - rect.left) / rect.width * svgWidth;
    const fraction = Math.max(0, Math.min(1, svgX / chartWidth));
    const step = Math.max(2, Math.round(effCount * 0.2));
    const newVc = Math.max(20, Math.min(candles.length, effCount - (e.nativeEvent.deltaY < 0 ? step : -step)));
    const globalIdx = off + fraction * Math.max(0, effCount - 1);
    const newLocalIdx = fraction * Math.max(0, newVc - 1);
    let newOff = Math.round(globalIdx - newLocalIdx);
    newOff = Math.max(0, Math.min(newOff, Math.max(0, candles.length - newVc)));
    setVisibleCount(newVc);
    setOffset(newOff);
    isDragging.current = false;
    setHoverIndex(null);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !candles.length) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartOffset.current = off;
    dragStartCount.current = effCount;
    setHoverIndex(null);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleReset = () => {
    setVisibleCount(candles.length);
    setOffset(0);
    setHoverIndex(null);
  };

  return (
    <div
      className="flex flex-col h-full select-none overflow-hidden rounded-md border"
      style={{
        backgroundColor: 'var(--ot-bg-panel)',
        borderColor: 'var(--ot-border)',
      }}
    >
      {/* Chart Header Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-surface)' }}
      >
        {/* Symbol Telemetry & Crosshair Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-wide" style={{ color: 'var(--ot-amber)' }}>
              {activeSymbol}
            </span>
            {paneTitle && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--accent)] border border-[var(--border)] font-bold">
                {paneTitle}
              </span>
            )}
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-300 font-mono">
              ${activeQuote.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {activeCandle && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
              <span>O: <strong className="text-slate-200">{activeCandle.open}</strong></span>
              <span>H: <strong className="text-slate-200">{activeCandle.high}</strong></span>
              <span>L: <strong className="text-slate-200">{activeCandle.low}</strong></span>
              <span>C: <strong className="text-slate-200">{activeCandle.close}</strong></span>
              {activeCandle.atr !== undefined && (
                <span className="text-amber-400">
                  ATR(14): ${activeCandle.atr} ({(activeCandle.atr * 10).toFixed(0)} pips)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Chart Options: Type, Timeframe, Overlays, Pivots, Fib, VPVR */}
        <div className="flex items-center gap-1.5">
          {/* Chart Style Toggle */}
          <div
            className="flex items-center p-0.5 rounded border text-[10px] font-mono"
            style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-panel)' }}
          >
            {chartStyles.map((style) => (
              <button
                key={style}
                onClick={() => setChartStyle(style)}
                className={`px-1.5 py-0.5 rounded uppercase transition-colors ${
                  chartStyle === style ? 'font-bold' : 'opacity-60 hover:opacity-100'
                }`}
                style={
                  chartStyle === style
                    ? { backgroundColor: 'var(--ot-bg-hover)', color: 'var(--ot-amber)' }
                    : {}
                }
              >
                {style}
              </button>
            ))}
          </div>

          {/* Timeframe Buttons */}
          <div
            className="flex items-center p-0.5 rounded border text-[10px] font-mono"
            style={{ borderColor: 'var(--ot-border)', backgroundColor: 'var(--ot-bg-panel)' }}
          >
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  setLocalTimeframe(tf);
                  if (!customTimeframe) setGlobalTimeframe(tf);
                }}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  activeTimeframe === tf ? 'font-bold' : 'opacity-60 hover:opacity-100'
                }`}
                style={
                  activeTimeframe === tf
                    ? { backgroundColor: 'var(--ot-bg-hover)', color: 'var(--ot-cyan)' }
                    : {}
                }
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Log / Linear Scale Toggle (Feature 3) */}
          <button
            onClick={() => setLogScale(!logScale)}
            title="Toggle logarithmic price scale"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              logScale ? 'font-bold' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              borderColor: logScale ? 'var(--ot-cyan)' : 'var(--ot-border)',
              backgroundColor: logScale ? 'var(--ot-bg-hover)' : 'transparent',
              color: logScale ? 'var(--ot-cyan)' : 'var(--ot-text-secondary)',
            }}
          >
            {logScale ? 'LOG' : 'LIN'}
          </button>

          {/* VPVR Toggle Button */}
          <button
            onClick={() => setVpvrEnabled(!vpvrEnabled)}
            title="Volume Profile Visible Range (VPVR / POC / VAH / VAL)"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              vpvrEnabled ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: vpvrEnabled ? 'var(--ot-amber)' : 'var(--ot-border)',
              backgroundColor: vpvrEnabled ? 'var(--ot-bg-hover)' : 'transparent',
              color: vpvrEnabled ? 'var(--ot-amber)' : 'var(--ot-text-secondary)',
            }}
          >
            VPVR
          </button>

          {/* Sessions Liquidity Sweeps Toggle */}
          <button
            onClick={() => setSessionsEnabled(!sessionsEnabled)}
            title="Previous Day High/Low (PDH/PDL) and Session Liquidity"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              sessionsEnabled ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: sessionsEnabled ? 'var(--ot-cyan)' : 'var(--ot-border)',
              backgroundColor: sessionsEnabled ? 'var(--ot-bg-hover)' : 'transparent',
              color: sessionsEnabled ? 'var(--ot-cyan)' : 'var(--ot-text-secondary)',
            }}
          >
            SESSIONS
          </button>

          {/* Fibonacci Toggle */}
          <button
            onClick={() => setFibonacciEnabled(!fibonacciEnabled)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              fibonacciEnabled ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: fibonacciEnabled ? 'var(--ot-amber)' : 'var(--ot-border)',
              backgroundColor: fibonacciEnabled ? 'var(--ot-bg-hover)' : 'transparent',
              color: fibonacciEnabled ? 'var(--ot-amber)' : 'var(--ot-text-secondary)',
            }}
          >
            FIB
          </button>

          {/* Pivot Points Selector */}
          <select
            value={pivotType}
            onChange={(e) => setPivotType(e.target.value as PivotType)}
            className="px-1.5 py-0.5 text-[10px] font-mono rounded border outline-none cursor-pointer"
            style={{
              borderColor: 'var(--ot-border)',
              backgroundColor: 'var(--ot-bg-panel)',
              color: 'var(--ot-text-secondary)',
            }}
          >
            <option value="off">Pivots: Off</option>
            <option value="classic">Pivots: Classic</option>
            <option value="fibonacci">Pivots: Fibonacci</option>
            <option value="camarilla">Pivots: Camarilla</option>
          </select>

          {/* Ichimoku Toggle */}
          <button
            onClick={() => toggleOverlayIndicator('ichimoku')}
            title="Ichimoku Kinko Hyo (Tenkan 9, Kijun 26, Senkou A/B)"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              overlayIndicators.includes('ichimoku') ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: overlayIndicators.includes('ichimoku') ? '#a855f7' : 'var(--ot-border)',
              backgroundColor: overlayIndicators.includes('ichimoku') ? 'rgba(168,85,247,0.2)' : 'transparent',
              color: overlayIndicators.includes('ichimoku') ? '#c084fc' : 'var(--ot-text-secondary)',
            }}
          >
            ICHIMOKU
          </button>

          {/* VWAP SD Bands Toggle */}
          <button
            onClick={() => toggleOverlayIndicator('vwap_bands')}
            title="VWAP Standard Deviation Bands (±1, ±2 SD)"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              overlayIndicators.includes('vwap_bands') ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: overlayIndicators.includes('vwap_bands') ? '#e879f9' : 'var(--ot-border)',
              backgroundColor: overlayIndicators.includes('vwap_bands') ? 'rgba(232,121,249,0.2)' : 'transparent',
              color: overlayIndicators.includes('vwap_bands') ? '#f0abfc' : 'var(--ot-text-secondary)',
            }}
          >
            VWAP SD
          </button>

          {/* Donchian Channels Toggle */}
          <button
            onClick={() => toggleOverlayIndicator('donchian')}
            title="Donchian Channels (20)"
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              overlayIndicators.includes('donchian') ? 'font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            style={{
              borderColor: overlayIndicators.includes('donchian') ? 'var(--ot-cyan)' : 'var(--ot-border)',
              backgroundColor: overlayIndicators.includes('donchian') ? 'rgba(56,189,248,0.2)' : 'transparent',
              color: overlayIndicators.includes('donchian') ? '#7dd3fc' : 'var(--ot-text-secondary)',
            }}
          >
            DONCHIAN
          </button>
        </div>
      </div>

      {/* Main Chart SVG Canvas */}
      <div ref={containerRef} className="relative flex-1 w-full min-h-0 bg-[#07090e]">
        <svg
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleReset}
        >
          <defs>
            <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ot-amber)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--ot-amber)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="vpvrBarGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0.35)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0.05)" />
            </linearGradient>
          </defs>

          {/* Feature 1: Last-price line + right-axis tag */}
          {lastCandle && (
            <>
              <line
                x1="0"
                y1={getY(lastClose)}
                x2={chartWidth}
                y2={getY(lastClose)}
                stroke={lastClose >= lastOpen ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                strokeWidth="1"
                strokeDasharray="6 3"
                opacity="0.9"
              />
              <g>
                <rect
                  x={chartWidth + 6}
                  y={Math.max(8, Math.min(pricePlotHeight - 10, getY(lastClose))) - 9}
                  width="76"
                  height="18"
                  fill={lastClose >= lastOpen ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                  rx="3"
                />
                <text
                  x={chartWidth + 44}
                  y={Math.max(8, Math.min(pricePlotHeight - 10, getY(lastClose))) + 4}
                  textAnchor="middle"
                  fill="#07090e"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ${lastClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
              </g>
            </>
          )}

          {/* Vertical Grid Lines */}
        {Array.from({ length: 8 }).map((_, i) => {
          const x = (chartWidth / 7) * i;
          return (
            <line key={'grid-x-'+i} x1={x} y1="0" x2={x} y2={pricePlotHeight} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          );
        })}

        {/* Horizontal Price Grid Lines */}
          {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((pct, i) => {
            const y = pricePlotHeight * pct;
            const priceVal = visMaxPrice - pct * (visMaxPrice - visMinPrice);
            return (
              <g key={`grid-y-${i}`}>
                <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text
                  x={chartWidth + 6}
                  y={y + 3}
                  fill="var(--ot-text-muted)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ${priceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </text>
              </g>
            );
          })}

          {/* Volume Profile Visible Range (VPVR) Histogram Overlay */}
          {volumeProfile &&
            volumeProfile.levels.map((lvl, i) => {
              const y = getY(lvl.price);
              if (y < 0 || y > pricePlotHeight) return null;
              const maxLvlVol = Math.max(...volumeProfile.levels.map((l) => l.volume), 1);
              const barWidth = (lvl.volume / maxLvlVol) * 140;
              const barX = chartWidth - barWidth;

              return (
                <g key={`vpvr-${i}`}>
                  <rect
                    x={barX}
                    y={y - 2.5}
                    width={barWidth}
                    height="5"
                    fill={lvl.isPoc ? 'rgba(255, 176, 0, 0.65)' : lvl.inValueArea ? 'rgba(0, 240, 255, 0.28)' : 'rgba(255, 255, 255, 0.09)'}
                    stroke={lvl.isPoc ? 'var(--ot-amber)' : 'none'}
                    strokeWidth="0.5"
                  />
                </g>
              );
            })}

          {/* VPVR Key Levels: Point of Control (POC), VAH, VAL */}
          {volumeProfile && (
            <>
              <line
                x1="0"
                y1={getY(volumeProfile.pocPrice)}
                x2={chartWidth}
                y2={getY(volumeProfile.pocPrice)}
                stroke="var(--ot-amber)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <rect
                x={chartWidth - 110}
                y={getY(volumeProfile.pocPrice) - 8}
                width="105"
                height="15"
                fill="var(--ot-bg-surface)"
                stroke="var(--ot-amber)"
                strokeWidth="1"
                rx="2"
              />
              <text
                x={chartWidth - 58}
                y={getY(volumeProfile.pocPrice) + 3}
                textAnchor="middle"
                fill="var(--ot-amber)"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                POC: ${volumeProfile.pocPrice}
              </text>

              <line
                x1="0"
                y1={getY(volumeProfile.vahPrice)}
                x2={chartWidth}
                y2={getY(volumeProfile.vahPrice)}
                stroke="var(--ot-cyan)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <text
                x={8}
                y={getY(volumeProfile.vahPrice) - 3}
                fill="var(--ot-cyan)"
                fontSize="9"
                fontFamily="monospace"
              >
                VAH (70%): ${volumeProfile.vahPrice}
              </text>

              <line
                x1="0"
                y1={getY(volumeProfile.valPrice)}
                x2={chartWidth}
                y2={getY(volumeProfile.valPrice)}
                stroke="var(--ot-cyan)"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <text
                x={8}
                y={getY(volumeProfile.valPrice) + 10}
                fill="var(--ot-cyan)"
                fontSize="9"
                fontFamily="monospace"
              >
                VAL (70%): ${volumeProfile.valPrice}
              </text>
            </>
          )}

          {/* Session Liquidity Levels (PDH & PDL) */}
          {sessionLiquidity && sessionLiquidity.pdh > 0 && (
            <>
              <line
                x1="0"
                y1={getY(sessionLiquidity.pdh)}
                x2={chartWidth}
                y2={getY(sessionLiquidity.pdh)}
                stroke="var(--ot-amber)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={chartWidth - 90}
                y={getY(sessionLiquidity.pdh) - 3}
                fill="var(--ot-amber)"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PDH: ${sessionLiquidity.pdh}
              </text>

              <line
                x1="0"
                y1={getY(sessionLiquidity.pdl)}
                x2={chartWidth}
                y2={getY(sessionLiquidity.pdl)}
                stroke="var(--ot-amber)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={chartWidth - 90}
                y={getY(sessionLiquidity.pdl) + 11}
                fill="var(--ot-amber)"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PDL: ${sessionLiquidity.pdl}
              </text>
            </>
          )}

          {/* Paper Trading Active Position Lines on Chart */}
          {activePositions.map((pos) => {
            const entryY = getY(pos.entryPrice);
            const slY = pos.sl ? getY(pos.sl) : null;
            const tpY = pos.tp ? getY(pos.tp) : null;
            const isBuy = pos.side === 'buy';

            return (
              <g key={`pos-chart-${pos.id}`}>
                <line
                  x1="0"
                  y1={entryY}
                  x2={chartWidth}
                  y2={entryY}
                  stroke={isBuy ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                  strokeWidth="1.5"
                />
                <rect
                  x="6"
                  y={entryY - 8}
                  width="130"
                  height="16"
                  fill="var(--ot-bg-surface)"
                  stroke={isBuy ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                  strokeWidth="1"
                  rx="2"
                />
                <text
                  x="71"
                  y={entryY + 3}
                  textAnchor="middle"
                  fill={isBuy ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {pos.side.toUpperCase()} {pos.lots}L @ ${pos.entryPrice.toFixed(2)}
                </text>

                {slY !== null && slY >= 0 && slY <= pricePlotHeight && (
                  <>
                    <line
                      x1="0"
                      y1={slY}
                      x2={chartWidth}
                      y2={slY}
                      stroke="var(--ot-loss)"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <text
                      x="8"
                      y={slY - 3}
                      fill="var(--ot-loss)"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      SL: ${pos.sl?.toFixed(2)}
                    </text>
                  </>
                )}

                {tpY !== null && tpY >= 0 && tpY <= pricePlotHeight && (
                  <>
                    <line
                      x1="0"
                      y1={tpY}
                      x2={chartWidth}
                      y2={tpY}
                      stroke="var(--ot-profit)"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <text
                      x="8"
                      y={tpY - 3}
                      fill="var(--ot-profit)"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      TP: ${pos.tp?.toFixed(2)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Pending Limit Orders Lines */}
          {pendingOrders.map((ord) => {
            const ordY = getY(ord.targetPrice);
            if (ordY < 0 || ordY > pricePlotHeight) return null;
            return (
              <g key={`ord-chart-${ord.id}`}>
                <line
                  x1="0"
                  y1={ordY}
                  x2={chartWidth}
                  y2={ordY}
                  stroke="var(--ot-cyan)"
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
                <text
                  x={chartWidth - 140}
                  y={ordY - 3}
                  fill="var(--ot-cyan)"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  LIMIT {ord.side.toUpperCase()} {ord.lots}L: ${ord.targetPrice.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Fibonacci Overlays */}
          {fibLevels.map((fib, i) => {
            const y = getY(fib.price);
            if (y < 0 || y > pricePlotHeight) return null;
            return (
              <g key={`fib-${i}`}>
                <line
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="var(--ot-amber)"
                  strokeDasharray="4 2"
                  strokeWidth="0.8"
                  opacity="0.8"
                />
                <text x={8} y={y - 3} fill="var(--ot-amber)" fontSize="9" fontFamily="monospace" fontWeight="bold">
                  FIB {fib.label}
                </text>
              </g>
            );
          })}

          {/* Institutional Pivot Lines (P, R1, R2, S1, S2) */}
          {pivotPoints && (
            <>
              <line x1="0" y1={getY(pivotPoints.p)} x2={chartWidth} y2={getY(pivotPoints.p)} stroke="var(--ot-cyan)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={chartWidth - 60} y={getY(pivotPoints.p) - 2} fill="var(--ot-cyan)" fontSize="9" fontFamily="monospace">P: ${pivotPoints.p}</text>
              <line x1="0" y1={getY(pivotPoints.r1)} x2={chartWidth} y2={getY(pivotPoints.r1)} stroke="var(--ot-profit)" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chartWidth - 65} y={getY(pivotPoints.r1) - 2} fill="var(--ot-profit)" fontSize="9" fontFamily="monospace">R1: ${pivotPoints.r1}</text>
              <line x1="0" y1={getY(pivotPoints.r2)} x2={chartWidth} y2={getY(pivotPoints.r2)} stroke="var(--ot-profit)" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chartWidth - 65} y={getY(pivotPoints.r2) - 2} fill="var(--ot-profit)" fontSize="9" fontFamily="monospace">R2: ${pivotPoints.r2}</text>
              <line x1="0" y1={getY(pivotPoints.s1)} x2={chartWidth} y2={getY(pivotPoints.s1)} stroke="var(--ot-loss)" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chartWidth - 65} y={getY(pivotPoints.s1) - 2} fill="var(--ot-loss)" fontSize="9" fontFamily="monospace">S1: ${pivotPoints.s1}</text>
              <line x1="0" y1={getY(pivotPoints.s2)} x2={chartWidth} y2={getY(pivotPoints.s2)} stroke="var(--ot-loss)" strokeWidth="0.8" strokeDasharray="2 2" />
              <text x={chartWidth - 65} y={getY(pivotPoints.s2) - 2} fill="var(--ot-loss)" fontSize="9" fontFamily="monospace">S2: ${pivotPoints.s2}</text>
            </>
          )}

          {/* Indicator Overlays (Moving Averages & Bollinger Bands) */}
          {upperBollPath && lowerBollPath && (
            <>
              <path d={upperBollPath} fill="none" stroke="var(--ot-cyan)" strokeWidth="0.9" strokeDasharray="3 3" opacity="0.6" />
              <path d={lowerBollPath} fill="none" stroke="var(--ot-cyan)" strokeWidth="0.9" strokeDasharray="3 3" opacity="0.6" />
            </>
          )}
          {sma20Path && <path d={sma20Path} fill="none" stroke="var(--ot-amber)" strokeWidth="1.2" opacity="0.85" />}
          {sma50Path && <path d={sma50Path} fill="none" stroke="var(--ot-cyan)" strokeWidth="1.2" opacity="0.85" />}
          {sma200Path && <path d={sma200Path} fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity="0.85" />}
          {ema9Path && <path d={ema9Path} fill="none" stroke="#34d399" strokeWidth="1.1" opacity="0.85" />}
          {ema21Path && <path d={ema21Path} fill="none" stroke="#fbbf24" strokeWidth="1.1" opacity="0.85" />}
          {vwapPath && <path d={vwapPath} fill="none" stroke="#e879f9" strokeWidth="1.3" strokeDasharray="4 2" opacity="0.9" />}

          {/* Phase II: Advanced Indicators Overlay Paths */}
          {tenkanPath && <path d={tenkanPath} fill="none" stroke="var(--ot-loss)" strokeWidth="1.2" opacity="0.9" />}
          {kijunPath && <path d={kijunPath} fill="none" stroke="#3b82f6" strokeWidth="1.2" opacity="0.9" />}
          {senkouAPath && <path d={senkouAPath} fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />}
          {senkouBPath && <path d={senkouBPath} fill="none" stroke="var(--ot-amber)" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />}

          {/* VWAP Standard Deviation Bands (±1, ±2 SD) */}
          {vwapSd1UpperPath && vwapSd1LowerPath && (
            <>
              <path d={vwapSd1UpperPath} fill="none" stroke="#c084fc" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
              <path d={vwapSd1LowerPath} fill="none" stroke="#c084fc" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
            </>
          )}
          {vwapSd2UpperPath && vwapSd2LowerPath && (
            <>
              <path d={vwapSd2UpperPath} fill="none" stroke="#e879f9" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
              <path d={vwapSd2LowerPath} fill="none" stroke="#e879f9" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
            </>
          )}

          {/* Donchian Channels (20) */}
          {donchianUpperPath && donchianLowerPath && (
            <>
              <path d={donchianUpperPath} fill="none" stroke="var(--ot-cyan)" strokeWidth="1" strokeDasharray="4 2" opacity="0.8" />
              <path d={donchianLowerPath} fill="none" stroke="var(--ot-cyan)" strokeWidth="1" strokeDasharray="4 2" opacity="0.8" />
              {donchianMidPath && <path d={donchianMidPath} fill="none" stroke="#7dd3fc" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.6" />}
            </>
          )}

          {/* Feature 2: Candle close countdown badge (top-right) */}
          {lastCandle && intervalSeconds > 0 && (
            <g>
              <rect
                x={chartWidth - 150}
                y={8}
                width="140"
                height="20"
                fill="var(--ot-bg-surface)"
                stroke="var(--ot-border)"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={chartWidth - 144}
                y={24}
                fill="var(--ot-cyan)"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                Closes in {formatRemaining(secondsRemaining)}
              </text>
            </g>
          )}

          {/* Watermark */}
          <text
            x={chartWidth / 2}
            y={pricePlotHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--ot-text-primary)"
            fontSize="32"
            fontFamily="monospace"
            fontWeight="bold"
            opacity="0.05"
            pointerEvents="none"
          >
            {activeSymbol}  OpenTerminal
          </text>

          {/* Volume Histogram (bottom band) + Feature 6: Volume MA overlay */}
          <g>
            {visCandles.map((c, j) => {
              const x = j * stepX;
              const isUp = c.close >= c.open;
              const color = isUp ? 'var(--ot-profit)' : 'var(--ot-loss)';
              const volH = visMaxVol > 0 ? ((c.volume || 0) / visMaxVol) * (pricePlotHeight * 0.16) : 0;
              const barW = Math.max(2, stepX * 0.6);
              return (
                <rect
                  key={'vol-'+(off + j)}
                  x={x - barW / 2}
                  y={pricePlotHeight - volH}
                  width={barW}
                  height={volH}
                  fill={color}
                  opacity="0.45"
                />
              );
            })}
            {volSma20.some((v) => v != null) && (
              <path
                d={volMaPath}
                fill="none"
                stroke="var(--ot-amber)"
                strokeWidth="1"
                opacity="0.8"
                strokeDasharray="2 2"
              />
            )}
          </g>

          {/* Candlesticks & Price Action Rendering (visible slice) */}
          {chartStyle === 'area' ? (
            <>
              <path d={linePath} fill="none" stroke="var(--ot-amber)" strokeWidth="2" />
              <path
                d={`${linePath} L ${Math.max(0, visLen - 1) * stepX} ${pricePlotHeight} L 0 ${pricePlotHeight} Z`}
                fill="url(#goldAreaGrad)"
              />
            </>
          ) : chartStyle === 'line' ? (
            <path d={linePath} fill="none" stroke="var(--ot-cyan)" strokeWidth="2" />
          ) : chartStyle === 'bar' ? (
            visCandles.map((c, j) => {
              const x = j * stepX;
              const isUp = c.close >= c.open;
              const color = isUp ? 'var(--ot-profit)' : 'var(--ot-loss)';
              const openY = getY(c.open);
              const closeY = getY(c.close);
              const highY = getY(c.high);
              const lowY = getY(c.low);
              return (
                <g key={`bar-${off + j}`}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1" />
                  <line x1={x - 3} y1={openY} x2={x} y2={openY} stroke={color} strokeWidth="1" />
                  <line x1={x} y1={closeY} x2={x + 3} y2={closeY} stroke={color} strokeWidth="1" />
                </g>
              );
            })
          ) : (
            visCandles.map((c, j) => {
              const x = j * stepX;
              const isUp = c.close >= c.open;
              const color = isUp ? 'var(--ot-profit)' : 'var(--ot-loss)';
              const candleTop = getY(Math.max(c.open, c.close));
              const candleBottom = getY(Math.min(c.open, c.close));
              const candleHeight = Math.max(2, candleBottom - candleTop);
              const highY = getY(c.high);
              const lowY = getY(c.low);
              const candleWidth = Math.max(3, stepX * 0.7);

              return (
                <g key={`candle-${off + j}`}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1" />
                  <rect
                    x={x - candleWidth / 2}
                    y={candleTop}
                    width={candleWidth}
                    height={candleHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth="0.5"
                  />
                </g>
              );
            })
          )}

          {/* Sub-Pane Indicator (RSI, MACD, Stoch, ATR) */}
          {isSubPaneActive && (
            <g transform={`translate(0, ${subPlotTop})`}>
              <line x1="0" y1="0" x2={chartWidth} y2="0" stroke="var(--ot-border)" strokeWidth="1" />
              {subPaneIndicator === 'rsi' && (
                <>
                  <text x="6" y="14" fill="var(--ot-cyan)" fontSize="9" fontFamily="monospace">RSI (14)</text>
                  <line x1="0" y1="25" x2={chartWidth} y2="25" stroke="var(--ot-loss)" strokeDasharray="2 2" strokeWidth="0.8" opacity="0.6" />
                  <text x={chartWidth + 6} y="28" fill="var(--ot-loss)" fontSize="9" fontFamily="monospace">70</text>
                  <line x1="0" y1="65" x2={chartWidth} y2="65" stroke="var(--ot-profit)" strokeDasharray="2 2" strokeWidth="0.8" opacity="0.6" />
                  <text x={chartWidth + 6} y="68" fill="var(--ot-profit)" fontSize="9" fontFamily="monospace">30</text>
                  <path
                    d={visCandles.reduce((acc, c, j) => {
                      const rsiVal = c.rsi ?? 50;
                      const y = subPlotHeight - (rsiVal / 100) * subPlotHeight;
                      const x = j * stepX;
                      return j === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="var(--ot-cyan)"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {subPaneIndicator === 'macd' && (
                <>
                  <text x="6" y="14" fill="var(--ot-cyan)" fontSize="9" fontFamily="monospace">MACD (12,26,9)</text>
                  <line x1="0" y1={macdZeroY} x2={chartWidth} y2={macdZeroY} stroke="var(--ot-border)" strokeWidth="1" opacity="0.4" />
                  {macdData.map((d, j) => {
                    if (d.histogram == null) return null;
                    const barW = Math.max(2, stepX * 0.6);
                    const y = macdValY(d.histogram);
                    const top = d.histogram >= 0 ? y : macdZeroY;
                    const height = Math.abs(macdZeroY - y);
                    return (
                      <rect
                        key={'macdh-' + (off + j)}
                        x={j * stepX - barW / 2}
                        y={top}
                        width={barW}
                        height={Math.max(1, height)}
                        fill={d.histogram >= 0 ? 'var(--ot-profit)' : 'var(--ot-loss)'}
                        opacity="0.6"
                      />
                    );
                  })}
                  <path
                    d={macdData.reduce((acc, d, j) => {
                      if (d.macd == null) return acc;
                      const x = j * stepX;
                      const y = macdValY(d.macd);
                      return `${acc}${acc ? ' L' : 'M'} ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="var(--ot-cyan)"
                    strokeWidth="1.2"
                  />
                  <path
                    d={macdData.reduce((acc, d, j) => {
                      if (d.signal == null) return acc;
                      const x = j * stepX;
                      const y = macdValY(d.signal);
                      return `${acc}${acc ? ' L' : 'M'} ${x} ${y}`;
                    }, '')}
                    fill="none"
                    stroke="var(--ot-amber)"
                    strokeWidth="1.1"
                  />
                </>
              )}
            </g>
          )}

          {/* Crosshair Cursor */}
          {effectiveHoverIndex !== null && candles[effectiveHoverIndex] && effectiveHoverIndex >= off && effectiveHoverIndex < off + visLen && (
            <g>
              <line
                x1={(effectiveHoverIndex - off) * stepX}
                y1="0"
                x2={(effectiveHoverIndex - off) * stepX}
                y2={totalHeight}
                stroke="var(--ot-cyan)"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.8"
              />
              <line
                x1="0"
                y1={getY(candles[effectiveHoverIndex].close)}
                x2={chartWidth}
                y2={getY(candles[effectiveHoverIndex].close)}
                stroke="var(--ot-cyan)"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.8"
              />
              <rect
                x={chartWidth + 2}
                y={getY(candles[effectiveHoverIndex].close) - 9}
                width="78"
                height="18"
                fill="var(--ot-cyan)"
                rx="3"
              />
              <text
                x={chartWidth + 41}
                y={getY(candles[effectiveHoverIndex].close) + 4}
                textAnchor="middle"
                fill="#07090e"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {candles[effectiveHoverIndex].close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </text>
              <circle cx={(effectiveHoverIndex - off) * stepX} cy={getY(candles[effectiveHoverIndex].close)} r="3.5" fill="var(--ot-amber)" />
              <rect
                x={(effectiveHoverIndex - off) * stepX - 35}
                y={totalHeight - 16}
                width="70"
                height="15"
                fill="var(--ot-bg-surface)"
                stroke="var(--ot-border)"
                rx="2"
              />
              <text
                x={(effectiveHoverIndex - off) * stepX}
                y={totalHeight - 5}
                textAnchor="middle"
                fill="var(--ot-cyan)"
                fontSize="9"
                fontFamily="monospace"
              >
                {candles[effectiveHoverIndex].time}
              </text>
            </g>
          )}
          {/* X-axis time labels (visible slice) */}
          {(() => {
            const n = 6;
            const out = [];
            for (let i = 0; i < n; i++) {
              const localIdx = Math.round((i / (n - 1)) * Math.max(0, visLen - 1));
              const c = visCandles[localIdx];
              if (!c) continue;
              const x = localIdx * stepX;
              out.push(
                <text key={'xt-'+i} x={x} y={pricePlotHeight + 12} textAnchor="middle" fill="var(--ot-text-muted)" fontSize="9" fontFamily="monospace">
                  {c.time}
                </text>
              );
            }
            return out;
          })()}

        </svg>

        {/* Legend Overlay at Bottom-Left of Chart */}
        <div className="absolute bottom-3 left-4 flex items-center gap-3 text-[10px] font-mono pointer-events-none opacity-85">
          {vpvrEnabled && (
            <div className="flex items-center gap-1 text-[var(--accent)]">
              <span>● VPVR (POC: ${volumeProfile?.pocPrice || '--'})</span>
            </div>
          )}
          {sessionsEnabled && sessionLiquidity && (
            <div className="flex items-center gap-1 text-orange-400">
              <span>PDH/PDL: ${sessionLiquidity.pdh}/${sessionLiquidity.pdl}</span>
            </div>
          )}
          {activePositions.length > 0 && (
            <div className="flex items-center gap-1 text-emerald-400 font-bold">
              <span>POSITIONS: {activePositions.length} ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
