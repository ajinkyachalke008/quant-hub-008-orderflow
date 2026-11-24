import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  Candle,
  ChartStyle,
  CommandLog,
  LayoutMode,
  OverlayIndicator,
  PivotType,
  SubPaneIndicator,
  ThemeId,
  TickerQuote,
  Timeframe,
  WidgetConfig,
  WidgetId,
} from '../types/terminal';
import { INITIAL_QUOTES, createEmptyQuote } from '../services/marketData';
import { executeCommand } from '../services/commandEngine';
import { xauusdService, XauSpotTick, XauConnectionState } from '../services/xauusdDataService';
import { computeTechnicalIndicators } from '../services/technicalAnalysis';
import { liveCandleService } from '../services/liveCandleService';

interface TerminalContextValue {
  activeSymbol: string;
  setActiveSymbol: (sym: string) => void;
  quotes: Record<string, TickerQuote>;
  activeQuote: TickerQuote;
  candles: Candle[];
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  chartStyle: ChartStyle;
  setChartStyle: (cs: ChartStyle) => void;
  overlayIndicators: OverlayIndicator[];
  toggleOverlayIndicator: (ind: OverlayIndicator) => void;
  subPaneIndicator: SubPaneIndicator | null;
  setSubPaneIndicator: (sub: SubPaneIndicator | null) => void;
  fibonacciEnabled: boolean;
  setFibonacciEnabled: (on: boolean) => void;
  pivotType: PivotType;
  setPivotType: (p: PivotType) => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  scanlines: boolean;
  setScanlines: (on: boolean) => void;
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
  widgets: WidgetConfig[];
  toggleWidgetVisibility: (id: WidgetId) => void;
  toggleWidgetMaximize: (id: WidgetId) => void;
  toggleWidgetMinimize: (id: WidgetId) => void;
  watchlist: string[];
  addToWatchlist: (sym: string) => void;
  removeFromWatchlist: (sym: string) => void;
  commandLogs: CommandLog[];
  executeTerminalCommand: (cmd: string) => void;
  clearCommandLogs: () => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  activeDataSource: string;
  connectionLatency: number;
  connectionState: XauConnectionState;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'chart', title: 'Interactive Chart', visible: true, minimized: false, maximized: false },
  { id: 'xau-telemetry', title: 'XAU/USD Spot Telemetry', visible: true, minimized: false, maximized: false },
  { id: 'xau-orderbook', title: 'XAU/USD Level II Orderbook', visible: true, minimized: false, maximized: false },
  { id: 'quote', title: 'Quote Fundamentals', visible: true, minimized: false, maximized: false },
  { id: 'watchlist', title: 'Watchlist & Sparklines', visible: true, minimized: false, maximized: false },
  { id: 'news', title: 'Market Wire & Sentiment', visible: true, minimized: false, maximized: false },
  { id: 'macro', title: 'Yield Curve & Macro', visible: true, minimized: false, maximized: false },
  { id: 'crypto', title: 'Crypto Market Board', visible: true, minimized: false, maximized: false },
  { id: 'screener', title: 'Equity Screener', visible: true, minimized: false, maximized: false },
  { id: 'heatmap', title: 'Sector Heatmap', visible: true, minimized: false, maximized: false },
  { id: 'cli', title: 'Terminal Command Console', visible: true, minimized: false, maximized: false },
  { id: 'crypto-ticker', title: 'Floating Crypto Ticker', visible: true, minimized: false, maximized: false },
  { id: 'order-flow', title: 'Order Flow Terminal', visible: true, minimized: false, maximized: false },
];

const TerminalContext = createContext<TerminalContextValue | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSymbol, setActiveSymbolState] = useState<string>('XAU/USD');
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>(INITIAL_QUOTES);
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candle');
  const [overlayIndicators, setOverlayIndicators] = useState<OverlayIndicator[]>(['sma20', 'bb', 'vwap']);
  const [subPaneIndicator, setSubPaneIndicator] = useState<SubPaneIndicator | null>('rsi');
  const [fibonacciEnabled, setFibonacciEnabled] = useState<boolean>(true);
  const [pivotType, setPivotType] = useState<PivotType>('classic');

  const [theme, setThemeState] = useState<ThemeId>('hybrid');
  const [scanlines, setScanlines] = useState<boolean>(false);
  const [layout, setLayoutState] = useState<LayoutMode>('xauusd');
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [watchlist, setWatchlist] = useState<string[]>([
    'XAU/USD',
    'NVDA',
    'BTC',
    'AAPL',
    'MSFT',
    'TSLA',
    'SPY',
    'SOL',
  ]);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([
    {
      id: 'init-1',
      command: 'boot openterminal',
      timestamp: new Date().toLocaleTimeString(),
      status: 'info',
      output: 'OpenTerminal v1.2.0 initialized with Pyth Hermes SSE & Binance Live Feeds.',
    },
    {
      id: 'init-2',
      command: 'symbol XAU/USD',
      timestamp: new Date().toLocaleTimeString(),
      status: 'success',
      output: 'Loaded Gold Spot XAU/USD. Streaming live Pyth Hermes / Binance depth.',
    },
  ]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [realCandles, setRealCandles] = useState<Candle[] | null>(null);
  const [activeDataSource, setActiveDataSource] = useState<string>(xauusdService.connectionState.activeSource);
  const [connectionLatency, setConnectionLatency] = useState<number>(xauusdService.connectionState.latencyMs);
  const [connectionState, setConnectionState] = useState<XauConnectionState>(xauusdService.connectionState);

  // Sync data-theme attribute on documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    if (t === 'retro') {
      setScanlines(true);
    }
  };

  // Subscribe to real-time Pyth / Binance Gold Spot Stream & Connection State
  useEffect(() => {
    const unsubConn = xauusdService.subscribeConnectionStatus((state) => {
      setConnectionState(state);
      setActiveDataSource(state.activeSource);
      setConnectionLatency(state.latencyMs);
    });

    const unsubPrice = xauusdService.subscribePrice((tick: XauSpotTick) => {
      setActiveDataSource(tick.source);
      setConnectionLatency(tick.latencyMs);

      setQuotes((prev) => ({
        ...prev,
        'XAU/USD': {
          symbol: 'XAU/USD',
          name: 'Gold Spot / US Dollar',
          price: tick.price,
          change: tick.change24h,
          changePercent: tick.changePercent24h,
          open: +(tick.price - tick.change24h).toFixed(2),
          high: tick.high24h,
          low: tick.low24h,
          volume: tick.volume24h,
          marketCap: '$17.2T',
          fiftyTwoWeekHigh: tick.high24h * 1.05,
          fiftyTwoWeekLow: tick.low24h * 0.75,
          assetType: 'commodity',
          sparkline: [...(prev['XAU/USD']?.sparkline.slice(1) || []), tick.price],
          confidence: tick.confidence,
          spread: +(tick.confidence * 2).toFixed(2),
        },
      }));
    });

    return () => {
      unsubConn();
      unsubPrice();
    };
  }, []);

  // Fetch real quote from server
  const fetchLiveQuote = async (sym: string) => {
    try {
      const resp = await fetch(`/api/quote/${encodeURIComponent(sym)}`);
      if (resp.ok) {
        const data = await resp.json();
        setQuotes((prev) => ({ ...prev, [sym]: data }));
      }
    } catch (_) {}
  };

  // Fetch real candles
  const fetchLiveCandles = async (sym: string, tf: Timeframe) => {
    if (sym === 'XAU/USD' || sym === 'XAUUSD' || sym === 'GOLD' || sym === 'XAU') {
      const goldCandles = await xauusdService.fetchHistoricalCandles(tf);
      if (goldCandles && goldCandles.length > 0) {
        setRealCandles(goldCandles);
        return;
      }
    }

    try {
      const resp = await fetch(`/api/chart/${encodeURIComponent(sym)}?tf=${tf}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          const withInd = computeTechnicalIndicators(data);
          setRealCandles(withInd);
          return;
        }
      }
    } catch (_) {}
    setRealCandles(null);
  };

  // Initial load
  useEffect(() => {
    fetchLiveQuote(activeSymbol);
    ['XAU/USD', 'NVDA', 'AAPL', 'MSFT', 'BTC', 'ETH', 'SOL', 'SPY'].forEach((s) => fetchLiveQuote(s));
  }, []);

  useEffect(() => {
    fetchLiveQuote(activeSymbol);
    if (!activeSymbol) return;
    let cancelled = false;
    const start = async () => {
      try { await liveCandleService.start(activeSymbol, timeframe); } catch (_) {}
    };
    start();
    const unsub = liveCandleService.subscribe((liveCandles) => {
      if (cancelled) return;
      const withInd = computeTechnicalIndicators(liveCandles);
      setRealCandles(withInd);
    });
    return () => {
      cancelled = true;
      unsub();
      liveCandleService.stop();
    };
  }, [activeSymbol, timeframe]);

  // Periodic polling for active symbol every 8s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveQuote(activeSymbol);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeSymbol]);

  const setActiveSymbol = (sym: string) => {
    let s = sym.toUpperCase();
    if (['GOLD', 'XAU', 'XAUUSD'].includes(s)) s = 'XAU/USD';

    if (!quotes[s]) {
      setQuotes((prev) => ({
        ...prev,
        [s]: createEmptyQuote(s),
      }));
    }
    setActiveSymbolState(s);
  };

  const activeQuote = useMemo(() => {
    return quotes[activeSymbol] || quotes['XAU/USD'] || INITIAL_QUOTES['XAU/USD'];
  }, [quotes, activeSymbol]);

  const candles = useMemo(() => {
    return realCandles ?? [];
  }, [realCandles]);

  const toggleOverlayIndicator = (ind: OverlayIndicator) => {
    setOverlayIndicators((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const addToWatchlist = (sym: string) => {
    let s = sym.toUpperCase();
    if (['GOLD', 'XAU', 'XAUUSD'].includes(s)) s = 'XAU/USD';
    if (!watchlist.includes(s)) {
      setWatchlist((prev) => [...prev, s]);
      setActiveSymbol(s);
    }
  };

  const removeFromWatchlist = (sym: string) => {
    setWatchlist((prev) => prev.filter((s) => s !== sym.toUpperCase()));
  };

  const toggleWidgetVisibility = (id: WidgetId) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const toggleWidgetMaximize = (id: WidgetId) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized, minimized: false } : w))
    );
  };

  const toggleWidgetMinimize = (id: WidgetId) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized, maximized: false } : w))
    );
  };

  const clearCommandLogs = () => {
    setCommandLogs([]);
  };

  const executeTerminalCommand = (cmdStr: string) => {
    const result = executeCommand(cmdStr, {
      activeSymbol,
      setActiveSymbol,
      activeTheme: theme,
      setTheme,
      layout,
      setLayout: setLayoutState,
      scanlines,
      setScanlines,
      timeframe,
      setTimeframe,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      clearLogs: clearCommandLogs,
      fibonacciEnabled,
      setFibonacciEnabled,
      pivotType,
      setPivotType,
      overlayIndicators,
      toggleOverlayIndicator,
      subPaneIndicator,
      setSubPaneIndicator,
      activePrice: activeQuote.price,
    });

    if (cmdStr.trim().toLowerCase() !== 'clear' && cmdStr.trim().toLowerCase() !== 'cls') {
      setCommandLogs((prev) => [
        ...prev,
        {
          id: `${Date.now().toString(36)}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 4) : performance.now().toFixed(0)}`,
          command: cmdStr,
          timestamp: new Date().toLocaleTimeString(),
          status: result.status,
          output: result.output,
        },
      ]);
    }
  };

  // Keyboard shortcut listener: âŒ˜K or Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TerminalContext.Provider
      value={{
        activeSymbol,
        setActiveSymbol,
        quotes,
        activeQuote,
        candles,
        timeframe,
        setTimeframe,
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
        theme,
        setTheme,
        scanlines,
        setScanlines,
        layout,
        setLayout: setLayoutState,
        widgets,
        toggleWidgetVisibility,
        toggleWidgetMaximize,
        toggleWidgetMinimize,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        commandLogs,
        executeTerminalCommand,
        clearCommandLogs,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        activeDataSource,
        connectionLatency,
        connectionState,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return ctx;
}


