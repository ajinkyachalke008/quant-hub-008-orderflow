import {
  Candle,
  HeatmapSector,
  MacroIndicator,
  NewsItem,
  ScreenerItem,
  TickerQuote,
  Timeframe,
} from '../types/terminal';

export const INITIAL_QUOTES: Record<string, TickerQuote> = {
  'XAU/USD': {
    symbol: 'XAU/USD',
    name: 'Gold Spot / US Dollar',
    price: 4043.50,
    change: 126.77,
    changePercent: 3.24,
    open: 3916.71,
    high: 4047.09,
    low: 3908.74,
    volume: '$12.04M',
    marketCap: '$17.2T',
    fiftyTwoWeekHigh: 4047.09,
    fiftyTwoWeekLow: 2750.00,
    assetType: 'commodity',
    sparkline: [3920, 3960, 3995, 4010, 4030, 4043.5],
    confidence: 0.15,
    bid: 4043.47,
    ask: 4043.48,
    spread: 0.01,
  },
  NVDA: {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 138.25,
    change: 3.42,
    changePercent: 2.54,
    open: 135.10,
    high: 139.80,
    low: 134.60,
    volume: '54.2M',
    marketCap: '$3.39T',
    peRatio: 52.4,
    fiftyTwoWeekHigh: 140.76,
    fiftyTwoWeekLow: 45.68,
    beta: 1.68,
    eps: 2.64,
    divYield: '0.03%',
    assetType: 'equity',
    sparkline: [132, 133.5, 134.8, 134.2, 136, 135.5, 137.2, 138.25],
  },
  AAPL: {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 232.10,
    change: 1.15,
    changePercent: 0.50,
    open: 230.80,
    high: 233.50,
    low: 230.20,
    volume: '41.8M',
    marketCap: '$3.54T',
    peRatio: 34.8,
    fiftyTwoWeekHigh: 237.23,
    fiftyTwoWeekLow: 164.08,
    beta: 1.05,
    eps: 6.67,
    divYield: '0.43%',
    assetType: 'equity',
    sparkline: [229.5, 230, 231.2, 230.8, 231.5, 231.9, 232.1],
  },
  MSFT: {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 432.80,
    change: -2.40,
    changePercent: -0.55,
    open: 435.50,
    high: 436.20,
    low: 431.10,
    volume: '22.3M',
    marketCap: '$3.22T',
    peRatio: 36.2,
    fiftyTwoWeekHigh: 468.35,
    fiftyTwoWeekLow: 366.50,
    beta: 1.14,
    eps: 11.95,
    divYield: '0.74%',
    assetType: 'equity',
    sparkline: [436, 435.2, 434, 434.8, 433.5, 432.8],
  },
  TSLA: {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 258.40,
    change: 8.65,
    changePercent: 3.46,
    open: 250.20,
    high: 261.00,
    low: 249.10,
    volume: '78.9M',
    marketCap: '$824.5B',
    peRatio: 74.1,
    fiftyTwoWeekHigh: 271.00,
    fiftyTwoWeekLow: 138.80,
    beta: 2.38,
    eps: 3.48,
    divYield: 'N/A',
    assetType: 'equity',
    sparkline: [248, 250.5, 253, 251.8, 255, 257.2, 258.4],
  },
  AMD: {
    symbol: 'AMD',
    name: 'Advanced Micro Devices',
    price: 156.90,
    change: 4.10,
    changePercent: 2.68,
    open: 153.20,
    high: 158.40,
    low: 152.80,
    volume: '38.4M',
    marketCap: '$253.8B',
    peRatio: 112.5,
    fiftyTwoWeekHigh: 227.30,
    fiftyTwoWeekLow: 116.50,
    beta: 1.72,
    eps: 1.39,
    divYield: 'N/A',
    assetType: 'equity',
    sparkline: [151, 153, 154.5, 153.8, 155.2, 156.9],
  },
  SPY: {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    price: 584.20,
    change: 3.10,
    changePercent: 0.53,
    open: 581.50,
    high: 585.10,
    low: 580.90,
    volume: '62.1M',
    marketCap: '$592B',
    fiftyTwoWeekHigh: 586.20,
    fiftyTwoWeekLow: 420.50,
    beta: 1.00,
    assetType: 'index',
    sparkline: [580, 581.2, 582, 582.8, 583.5, 584.2],
  },
  QQQ: {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    price: 495.60,
    change: 4.85,
    changePercent: 0.99,
    open: 491.20,
    high: 496.40,
    low: 490.50,
    volume: '34.7M',
    marketCap: '$288B',
    fiftyTwoWeekHigh: 503.52,
    fiftyTwoWeekLow: 350.20,
    beta: 1.18,
    assetType: 'index',
    sparkline: [489, 491, 492.5, 493.8, 494.5, 495.6],
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 68450.00,
    change: 1250.00,
    changePercent: 1.86,
    open: 67200.00,
    high: 69120.00,
    low: 66950.00,
    volume: '$28.4B',
    marketCap: '$1.35T',
    fiftyTwoWeekHigh: 73750.00,
    fiftyTwoWeekLow: 34100.00,
    assetType: 'crypto',
    sparkline: [66800, 67200, 67800, 67400, 68100, 68450],
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 2540.80,
    change: 48.20,
    changePercent: 1.93,
    open: 2492.60,
    high: 2575.00,
    low: 2480.00,
    volume: '$14.2B',
    marketCap: '$305.8B',
    fiftyTwoWeekHigh: 4090.00,
    fiftyTwoWeekLow: 1820.00,
    assetType: 'crypto',
    sparkline: [2470, 2490, 2510, 2505, 2530, 2540.8],
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    price: 178.60,
    change: 7.90,
    changePercent: 4.63,
    open: 170.70,
    high: 181.20,
    low: 169.50,
    volume: '$4.1B',
    marketCap: '$83.9B',
    fiftyTwoWeekHigh: 209.90,
    fiftyTwoWeekLow: 38.50,
    assetType: 'crypto',
    sparkline: [168, 171, 173, 172.5, 176, 178.6],
  },
};

export const MACRO_DATA: MacroIndicator[] = [
  {
    id: 'us10y',
    name: 'US 10-Year Treasury Yield',
    value: '4.24%',
    change: '+0.03 bps',
    deltaType: 'up',
    category: 'Rates & Yields',
    description: 'Benchmark rate for global debt, mortgages, and equity discount cashflows.',
    sparkline: [4.12, 4.15, 4.18, 4.17, 4.21, 4.24],
  },
  {
    id: 'us02y',
    name: 'US 2-Year Treasury Yield',
    value: '4.08%',
    change: '+0.01 bps',
    deltaType: 'up',
    category: 'Rates & Yields',
    description: 'Short-term rate proxy closely tracking Federal Reserve policy expectations.',
    sparkline: [4.02, 4.04, 4.06, 4.05, 4.07, 4.08],
  },
  {
    id: 'fedfunds',
    name: 'Effective Fed Funds Rate',
    value: '4.83%',
    change: '0.00 bps',
    deltaType: 'neutral',
    category: 'Rates & Yields',
    description: 'Volume-weighted median of overnight interbank lending transactions.',
    sparkline: [5.33, 5.33, 5.33, 5.08, 4.83, 4.83],
  },
  {
    id: 'vix',
    name: 'CBOE Volatility Index (VIX)',
    value: '17.85',
    change: '-0.82 (-4.39%)',
    deltaType: 'down',
    category: 'Volatility & Liquidity',
    description: 'Expected 30-day market volatility implied by S&P 500 option prices.',
    sparkline: [21.5, 20.2, 19.4, 18.9, 18.3, 17.85],
  },
  {
    id: 'cpi',
    name: 'US Headline CPI (YoY)',
    value: '2.40%',
    change: '-0.10%',
    deltaType: 'down',
    category: 'Inflation & Labor',
    description: 'Consumer Price Index measure of annual headline consumer goods inflation.',
    sparkline: [3.1, 2.9, 2.7, 2.5, 2.4],
  },
  {
    id: 'unemp',
    name: 'US Unemployment Rate',
    value: '4.10%',
    change: '0.00%',
    deltaType: 'neutral',
    category: 'Inflation & Labor',
    description: 'Total unemployed persons as a percentage of the civilian labor force.',
    sparkline: [3.9, 4.0, 4.1, 4.1],
  },
];

export const SCREENER_ITEMS: ScreenerItem[] = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Semiconductors', price: 138.25, change: 2.54, marketCap: '$3.39T', marketCapNum: 3390, peRatio: 52.4, volume: '54.2M', rsi: 68 },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Consumer Electronics', price: 232.10, change: 0.50, marketCap: '$3.54T', marketCapNum: 3540, peRatio: 34.8, volume: '41.8M', rsi: 54 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Software - Infrastructure', price: 432.80, change: -0.55, marketCap: '$3.22T', marketCapNum: 3220, peRatio: 36.2, volume: '22.3M', rsi: 48 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Internet Content', price: 172.40, change: 1.25, marketCap: '$2.12T', marketCapNum: 2120, peRatio: 23.5, volume: '28.1M', rsi: 57 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Internet Retail', price: 191.60, change: 1.80, marketCap: '$1.99T', marketCapNum: 1990, peRatio: 44.1, volume: '33.5M', rsi: 62 },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Internet Content', price: 588.90, change: 2.15, marketCap: '$1.48T', marketCapNum: 1480, peRatio: 29.8, volume: '16.7M', rsi: 64 },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Auto Manufacturers', price: 258.40, change: 3.46, marketCap: '$824.5B', marketCapNum: 824, peRatio: 74.1, volume: '78.9M', rsi: 71 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Semiconductors', price: 156.90, change: 2.68, marketCap: '$253.8B', marketCapNum: 253, peRatio: 112.5, volume: '38.4M', rsi: 59 },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Software - Infrastructure', price: 44.20, change: 5.12, marketCap: '$99.2B', marketCapNum: 99, peRatio: 88.0, volume: '62.0M', rsi: 76 },
  { symbol: 'COIN', name: 'Coinbase Global', sector: 'Financial Data', price: 216.50, change: 4.80, marketCap: '$53.4B', marketCapNum: 53, peRatio: 38.2, volume: '14.2M', rsi: 66 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Banks - Diversified', price: 224.30, change: 0.32, marketCap: '$642.1B', marketCapNum: 642, peRatio: 12.4, volume: '11.8M', rsi: 52 },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', sector: 'Drug Manufacturers', price: 890.10, change: -1.20, marketCap: '$845.0B', marketCapNum: 845, peRatio: 64.2, volume: '3.1M', rsi: 45 },
];

export const HEATMAP_SECTORS: HeatmapSector[] = [
  {
    name: 'Technology',
    change: 2.12,
    items: [
      { symbol: 'NVDA', name: 'Nvidia', change: 2.54, price: 138.25, marketCap: '$3.39T', weight: 35 },
      { symbol: 'AAPL', name: 'Apple', change: 0.50, price: 232.10, marketCap: '$3.54T', weight: 35 },
      { symbol: 'MSFT', name: 'Microsoft', change: -0.55, price: 432.80, marketCap: '$3.22T', weight: 30 },
    ],
  },
  {
    name: 'Consumer & Comm',
    change: 1.64,
    items: [
      { symbol: 'GOOGL', name: 'Alphabet', change: 1.25, price: 172.40, marketCap: '$2.12T', weight: 35 },
      { symbol: 'AMZN', name: 'Amazon', change: 1.80, price: 191.60, marketCap: '$1.99T', weight: 35 },
      { symbol: 'META', name: 'Meta', change: 2.15, price: 588.90, marketCap: '$1.48T', weight: 30 },
    ],
  },
  {
    name: 'Semis & EV',
    change: 3.10,
    items: [
      { symbol: 'TSLA', name: 'Tesla', change: 3.46, price: 258.40, marketCap: '$824B', weight: 45 },
      { symbol: 'AMD', name: 'AMD', change: 2.68, price: 156.90, marketCap: '$253B', weight: 35 },
      { symbol: 'PLTR', name: 'Palantir', change: 5.12, price: 44.20, marketCap: '$99B', weight: 20 },
    ],
  },
  {
    name: 'Crypto Assets',
    change: 2.45,
    items: [
      { symbol: 'BTC', name: 'Bitcoin', change: 1.86, price: 68450.00, marketCap: '$1.35T', weight: 55 },
      { symbol: 'ETH', name: 'Ethereum', change: 1.93, price: 2540.80, marketCap: '$305B', weight: 25 },
      { symbol: 'SOL', name: 'Solana', change: 4.63, price: 178.60, marketCap: '$83B', weight: 20 },
    ],
  },
];

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

/**
 * Generates synthetic OHLCV candles with indicators calculated for any symbol & timeframe
 */
export function generateCandles(basePrice: number, timeframe: Timeframe): Candle[] {
  const count = ['1m', '5m', '15m'].includes(timeframe) ? 45 : ['30m', '1h', '4h'].includes(timeframe) ? 50 : 60;
  const candles: Candle[] = [];
  let currentPrice = basePrice * (timeframe === '1W' ? 0.88 : timeframe === '1M' ? 0.94 : 0.98);

  const now = new Date();

  for (let i = 0; i < count; i++) {
    const timeDelta = count - 1 - i;
    const date = new Date(now);
    
    if (['1m', '5m', '15m'].includes(timeframe)) {
      date.setMinutes(date.getMinutes() - timeDelta * (timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : 15));
    } else if (['30m', '1h', '4h'].includes(timeframe)) {
      date.setHours(date.getHours() - timeDelta * (timeframe === '30m' ? 0.5 : timeframe === '1h' ? 1 : 4));
    } else {
      date.setDate(date.getDate() - timeDelta * (timeframe === '1W' ? 7 : 1));
    }

    const volatility = basePrice * 0.008;
    const change = 0.001 * volatility;
    const open = currentPrice;
    const close = +(open + change).toFixed(2);
    const high = +(Math.max(open, close) + volatility * 0.4).toFixed(2);
    const low = +(Math.min(open, close) - volatility * 0.4).toFixed(2);
    const volume = 250000;

    candles.push({
      time: ['1m', '5m', '15m', '30m', '1h', '4h'].includes(timeframe)
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  // Pin the last close close to the actual basePrice
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = basePrice;
    last.high = Math.max(last.high, basePrice);
    last.low = Math.min(last.low, basePrice);
  }

  // Calculate technical indicators (SMA 20, EMA 50, Bollinger Bands)
  for (let i = 0; i < candles.length; i++) {
    // SMA 20
    const smaWindow = 20;
    if (i >= smaWindow - 1) {
      let sum = 0;
      for (let j = i - smaWindow + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      const mean = sum / smaWindow;
      candles[i].sma20 = Number(mean.toFixed(2));

      // Bollinger Bands (2 std devs)
      let varianceSum = 0;
      for (let j = i - smaWindow + 1; j <= i; j++) {
        varianceSum += Math.pow(candles[j].close - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / smaWindow);
      candles[i].upperBand = Number((mean + 2 * stdDev).toFixed(2));
      candles[i].lowerBand = Number((mean - 2 * stdDev).toFixed(2));
    }

    // EMA
    if (i === 0) {
      candles[i].ema50 = candles[i].close;
    } else {
      const prevEma = candles[i - 1].ema50 ?? candles[i - 1].close;
      const k = 2 / (30 + 1); // 30-period EMA representation
      candles[i].ema50 = Number((candles[i].close * k + prevEma * (1 - k)).toFixed(2));
    }
  }

  return candles;
}
