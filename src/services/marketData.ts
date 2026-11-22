import {
  AssetType,
  Candle,
  HeatmapSector,
  MacroIndicator,
  NewsItem,
  ScreenerItem,
  TickerQuote,
  Timeframe,
} from '../types/terminal';

/**
 * marketData.ts
 *
 * This module is the single source of symbol configuration + live market-data
 * access for the terminal. It runs in the browser, so all network access goes
 * through the same-origin server endpoints in server.ts (which proxy Binance,
 * Yahoo Finance and FRED server-side to avoid CORS / regional geo-blocking):
 *
 *   GET /api/quote/:symbol        -> TickerQuote
 *   GET /api/chart/:symbol?tf=..  -> Candle[]
 *   GET /api/macro                -> MacroIndicator[]
 *
 * The exported *constants below are CONFIGURATION ONLY (symbol identity, names,
 * sectors, weights). They intentionally contain NO fabricated market values
 * (prices / candles / volumes / changes are all zero / "N/A"). Real numbers are
 * hydrated at runtime through the fetch* helpers and are never synthetic.
 */

// ---------------------------------------------------------------------------
// Quote construction (config seed / honest empty state)
// ---------------------------------------------------------------------------

/**
 * Builds a neutral TickerQuote shell carrying only identity/config fields.
 * All market values start at 0 / "N/A" and are replaced by real data from
 * /api/quote once available. Never presented to the user as a real price.
 */
export function createEmptyQuote(
  symbol: string,
  name?: string,
  assetType: AssetType = 'equity',
): TickerQuote {
  return {
    symbol,
    name: name ?? symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    volume: 'N/A',
    marketCap: 'N/A',
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
    assetType,
    sparkline: [],
  };
}

/**
 * Tracked-symbol registry (legitimate configuration, NOT market data).
 * Used to seed the quotes map before live quotes arrive and as the symbol
 * search index for the command palette.
 */
export const INITIAL_QUOTES: Record<string, TickerQuote> = {
  'XAU/USD': createEmptyQuote('XAU/USD', 'Gold Spot / US Dollar', 'commodity'),
  NVDA: createEmptyQuote('NVDA', 'NVIDIA Corporation', 'equity'),
  AAPL: createEmptyQuote('AAPL', 'Apple Inc.', 'equity'),
  MSFT: createEmptyQuote('MSFT', 'Microsoft Corporation', 'equity'),
  TSLA: createEmptyQuote('TSLA', 'Tesla, Inc.', 'equity'),
  AMD: createEmptyQuote('AMD', 'Advanced Micro Devices', 'equity'),
  SPY: createEmptyQuote('SPY', 'SPDR S&P 500 ETF Trust', 'index'),
  QQQ: createEmptyQuote('QQQ', 'Invesco QQQ Trust (Nasdaq 100)', 'index'),
  BTC: createEmptyQuote('BTC', 'Bitcoin', 'crypto'),
  ETH: createEmptyQuote('ETH', 'Ethereum', 'crypto'),
  SOL: createEmptyQuote('SOL', 'Solana', 'crypto'),
};

// ---------------------------------------------------------------------------
// Macro indicators (config seed only; values hydrated from /api/macro)
// ---------------------------------------------------------------------------

export const MACRO_DATA: MacroIndicator[] = [
  {
    id: 'us10y',
    name: 'US 10-Year Treasury Yield',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Rates & Yields',
    description: 'Benchmark rate for global debt, mortgages, and equity discount cashflows.',
    sparkline: [],
  },
  {
    id: 'us02y',
    name: 'US 2-Year Treasury Yield',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Rates & Yields',
    description: 'Short-term rate proxy closely tracking Federal Reserve policy expectations.',
    sparkline: [],
  },
  {
    id: 'fedfunds',
    name: 'Effective Fed Funds Rate',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Rates & Yields',
    description: 'Volume-weighted median of overnight interbank lending transactions.',
    sparkline: [],
  },
  {
    id: 'vix',
    name: 'CBOE Volatility Index (VIX)',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Volatility & Liquidity',
    description: 'Expected 30-day market volatility implied by S&P 500 option prices.',
    sparkline: [],
  },
  {
    id: 'cpi',
    name: 'US Headline CPI (YoY)',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Inflation & Labor',
    description: 'Consumer Price Index measure of annual headline consumer goods inflation.',
    sparkline: [],
  },
  {
    id: 'unemp',
    name: 'US Unemployment Rate',
    value: 'N/A',
    change: 'N/A',
    deltaType: 'neutral',
    category: 'Inflation & Labor',
    description: 'Total unemployed persons as a percentage of the civilian labor force.',
    sparkline: [],
  },
];

// ---------------------------------------------------------------------------
// Equity screener (config seed only; prices/changes hydrated from /api/quote)
// ---------------------------------------------------------------------------

export const SCREENER_ITEMS: ScreenerItem[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Consumer Electronics', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Software - Infrastructure', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Internet Content', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Internet Retail', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Internet Content', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Auto Manufacturers', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Software - Infrastructure', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'COIN', name: 'Coinbase Global', sector: 'Financial Data', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Banks - Diversified', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Drug Manufacturers', price: 0, change: 0, marketCap: 'N/A', marketCapNum: 0, peRatio: 0, volume: 'N/A', rsi: 0 },
];

// ---------------------------------------------------------------------------
// Sector heatmap (config seed only: sector/item identity + grid weights.
// Prices/changes/market-caps hydrated from /api/quote at runtime.)
// ---------------------------------------------------------------------------

export const HEATMAP_SECTORS: HeatmapSector[] = [
  {
    name: 'Technology',
    change: 0,
    items: [
      { symbol: 'NVDA', name: 'Nvidia', change: 0, price: 0, marketCap: 'N/A', weight: 35 },
      { symbol: 'AAPL', name: 'Apple', change: 0, price: 0, marketCap: 'N/A', weight: 35 },
      { symbol: 'MSFT', name: 'Microsoft', change: 0, price: 0, marketCap: 'N/A', weight: 30 },
    ],
  },
  {
    name: 'Consumer & Comm',
    change: 0,
    items: [
      { symbol: 'GOOGL', name: 'Alphabet', change: 0, price: 0, marketCap: 'N/A', weight: 35 },
      { symbol: 'AMZN', name: 'Amazon', change: 0, price: 0, marketCap: 'N/A', weight: 35 },
      { symbol: 'META', name: 'Meta', change: 0, price: 0, marketCap: 'N/A', weight: 30 },
    ],
  },
  {
    name: 'Semis & EV',
    change: 0,
    items: [
      { symbol: 'TSLA', name: 'Tesla', change: 0, price: 0, marketCap: 'N/A', weight: 45 },
      { symbol: 'AMD', name: 'AMD', change: 0, price: 0, marketCap: 'N/A', weight: 35 },
      { symbol: 'PLTR', name: 'Palantir', change: 0, price: 0, marketCap: 'N/A', weight: 20 },
    ],
  },
  {
    name: 'Crypto Assets',
    change: 0,
    items: [
      { symbol: 'BTC', name: 'Bitcoin', change: 0, price: 0, marketCap: 'N/A', weight: 55 },
      { symbol: 'ETH', name: 'Ethereum', change: 0, price: 0, marketCap: 'N/A', weight: 25 },
      { symbol: 'SOL', name: 'Solana', change: 0, price: 0, marketCap: 'N/A', weight: 20 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Market wire (DEMO / SAMPLE editorial content)
// ---------------------------------------------------------------------------
// NOTE: These are illustrative sample headlines, NOT live news. They carry no
// fabricated market values (prices/candles/volumes/changes); they are editorial
// placeholders. No free, key-less, CORS-safe news API is wired into this app, so
// this feed is intentionally kept as clearly-labelled demo content rather than
// presented as a live wire. Replace with a real news provider when available.
export const NEWS_FEED: NewsItem[] = [
  {
    id: 'n0',
    title: 'XAU/USD Gold Spot Surges Past $4,000 on Unprecedented Sovereign Reserve Diversification',
    source: 'LBMA Bullion Wire',
    timeAgo: '4m ago',
    sentiment: 'bullish',
    symbols: ['XAU/USD', 'US10Y'],
    snippet: 'Physical London Good Delivery bullion demand reaches historic levels as central banks accelerate gold allocations.',
  },
  {
    id: 'n1',
    title: 'NVIDIA Expands Blackwell Ultra Architecture Deployments Across Cloud Superclusters',
    source: 'Bloomberg Technology',
    timeAgo: '12m ago',
    sentiment: 'bullish',
    symbols: ['NVDA', 'MSFT'],
    snippet: 'Enterprise demand for multi-node accelerator clusters accelerates into the next fiscal quarter.',
  },
  {
    id: 'n2',
    title: 'FOMC Minutes Signal Calibrated Rate Adjustments Amid Resilient Labor Market',
    source: 'Reuters Macro',
    timeAgo: '28m ago',
    sentiment: 'neutral',
    symbols: ['SPY', 'QQQ', 'US10Y'],
    snippet: 'Federal Reserve governors stress data dependency with headline inflation stabilizing near 2.4%.',
  },
  {
    id: 'n3',
    title: 'Bitcoin Surges Past $68,000 as Institutional Spot Inflows Hit New Weekly Highs',
    source: 'CoinDesk Desk',
    timeAgo: '41m ago',
    sentiment: 'bullish',
    symbols: ['BTC', 'ETH', 'COIN'],
    snippet: 'Net ETF inflows crossed $450 million in 24 hours, driven by sustained custody allocations.',
  },
  {
    id: 'n4',
    title: 'Tesla Robotaxi Network Certification Begins Regulatory Review in Key States',
    source: 'Financial Times',
    timeAgo: '1h ago',
    sentiment: 'bullish',
    symbols: ['TSLA'],
    snippet: 'Autonomous vehicle test permits and safety documentation filed ahead of public pilot rollout.',
  },
  {
    id: 'n5',
    title: 'Tech Mega-Caps Drive S&P 500 to Fresh Record Highs as Earnings Season Kicks Off',
    source: 'Wall Street Journal',
    timeAgo: '2h ago',
    sentiment: 'bullish',
    symbols: ['SPY', 'AAPL', 'GOOGL'],
    snippet: 'Broad equity indices advance for the fourth consecutive session led by semiconductor strength.',
  },
];

// ---------------------------------------------------------------------------
// Live data access (real network fetches via same-origin server endpoints)
// ---------------------------------------------------------------------------

const QUOTE_TTL_MS = 8000; // matches server.ts cache cadence
const CANDLE_TTL_MS = 8000;

const quoteCache = new Map<string, { ts: number; data: TickerQuote }>();
const candleCache = new Map<string, { ts: number; data: Candle[] }>();

/**
 * Fetches a single real quote from /api/quote/:symbol (Binance / Yahoo proxy).
 * Returns null on failure — never synthetic fallback data.
 */
export async function fetchLiveQuote(symbol: string): Promise<TickerQuote | null> {
  const key = symbol.toUpperCase();
  const cached = quoteCache.get(key);
  if (cached && Date.now() - cached.ts < QUOTE_TTL_MS) {
    return cached.data;
  }
  try {
    const resp = await fetch(`/api/quote/${encodeURIComponent(key)}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as TickerQuote;
    if (!data || typeof data.price !== 'number') return null;
    quoteCache.set(key, { ts: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetches real quotes for many symbols concurrently. Symbols that fail to load
 * are simply omitted from the result (callers keep their config/empty state).
 */
export async function fetchQuotesForSymbols(
  symbols: string[],
): Promise<Record<string, TickerQuote>> {
  const out: Record<string, TickerQuote> = {};
  await Promise.all(
    symbols.map(async (s) => {
      const q = await fetchLiveQuote(s);
      if (q) out[q.symbol] = q;
    }),
  );
  return out;
}

/**
 * Fetches real OHLCV candles for a symbol/timeframe from /api/chart/:symbol.
 * Returns an empty array on failure — never synthetic candles.
 */
export async function fetchLiveCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const key = `${symbol.toUpperCase()}_${timeframe}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.ts < CANDLE_TTL_MS) {
    return cached.data;
  }
  try {
    const resp = await fetch(
      `/api/chart/${encodeURIComponent(symbol)}?tf=${encodeURIComponent(timeframe)}`,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    const candles = data as Candle[];
    candleCache.set(key, { ts: Date.now(), data: candles });
    return candles;
  } catch {
    return [];
  }
}

/**
 * @deprecated Synthetic candle generation has been removed.
 *
 * This shim is kept only so existing imports keep compiling. It NEVER produces
 * fabricated OHLCV data. Real candles come from fetchLiveCandles() /
 * /api/chart (see TerminalContext). Always returns an empty array so the UI
 * renders an honest empty state until real data loads.
 */
export function generateCandles(_basePrice: number, _timeframe: Timeframe): Candle[] {
  return [];
}
