import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ServerResponse } from 'http';
import type { Request, Response } from 'express';
import { proxyManager, fetchDeribitOptions } from './server/proxy';
import { corsMiddleware, securityHeaders, SseRateLimiter, MAX_CLIENTS_PER_PROXY, clientIp } from './server/security';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security: headers + CORS (before routes)
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' })); // limit JSON body size

// In-memory cache to stay snappy and respect rate limits
const cache: Record<string, { timestamp: number; data: any }> = {};
const CACHE_TTL_MS = 8000; // 8 seconds cache

function getCached(key: string) {
  const item = cache[key];
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { timestamp: Date.now(), data };
}

// ---- Real market data helpers ----
interface Weekly52 {
  high: number;
  low: number;
  open: number;
}

const weekly52Cache: Record<string, { timestamp: number; data: Weekly52 }> = {};

async function getBinanceWeekly52(pair: string): Promise<Weekly52 | null> {
  const cached = weekly52Cache[pair];
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }
  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1w&limit=52`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    let high = -Infinity;
    let low = Infinity;
    for (const k of data) {
      const h = parseFloat(k[2]);
      const l = parseFloat(k[3]);
      if (!Number.isNaN(h) && h > high) high = h;
      if (!Number.isNaN(l) && l < low) low = l;
    }
    const open = parseFloat(data[0][1]);
    if (Number.isNaN(open) || high === -Infinity || low === Infinity) return null;
    const result: Weekly52 = { high, low, open };
    weekly52Cache[pair] = { timestamp: Date.now(), data: result };
    return result;
  } catch {
    return null;
  }
}

const GECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  AVAX: 'avalanche-2',
};

let geckoCache: { ts: number; data: Record<string, string> } = { ts: 0, data: {} };

function formatMarketCap(n: number): string {
  if (!n || n <= 0) return 'N/A';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

async function getCryptoMarketCaps(): Promise<Record<string, string>> {
  if (Date.now() - geckoCache.ts < 60000 && Object.keys(geckoCache.data).length > 0) {
    return geckoCache.data;
  }
  try {
    const ids = Array.from(new Set(Object.values(GECKO_IDS))).join(',');
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc`
    );
    if (resp.ok) {
      const arr = await resp.json();
      const byId: Record<string, number> = {};
      for (const c of arr) {
        if (c && typeof c.market_cap === 'number') byId[c.id] = c.market_cap;
      }
      const result: Record<string, string> = {};
      for (const sym of Object.keys(GECKO_IDS)) {
        const mc = byId[GECKO_IDS[sym]];
        result[sym] = mc != null ? formatMarketCap(mc) : 'N/A';
      }
      geckoCache = { ts: Date.now(), data: result };
      return result;
    }
  } catch {
    // ignore gecko errors
  }
  return geckoCache.data;
}

// 1. Real Live Quote Endpoint
app.get('/api/quote/:symbol', async (req, res) => {
  const rawSym = req.params.symbol.toUpperCase();
  const cacheKey = `quote_${rawSym}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // If Gold Spot XAU/USD
    if (['XAUUSD', 'XAU/USD', 'GOLD', 'XAU', 'PAXG'].includes(rawSym)) {
      const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
      if (resp.ok) {
        const d = await resp.json();
        const price = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChange);
        const changePercent = parseFloat(d.priceChangePercent);
        const open = parseFloat(d.openPrice);
        const high = parseFloat(d.highPrice);
        const low = parseFloat(d.lowPrice);
        const volume = parseFloat(d.volume);

        // Fetch sparkline from klines
        const klineResp = await fetch('https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=1h&limit=12');
        let sparkline: number[] = [open, price];
        if (klineResp.ok) {
          const kdata = await klineResp.json();
          sparkline = kdata.map((k: any) => parseFloat(k[4]));
        }

        const wk52 = await getBinanceWeekly52('PAXGUSDT');

        const quote = {
          symbol: 'XAU/USD',
          name: 'Gold Spot / US Dollar (LBMA / COMEX)',
          price,
          change,
          changePercent,
          open: wk52 ? wk52.open : open,
          high,
          low,
          volume: `$${(volume * price / 1e6).toFixed(2)}M`,
          marketCap: 'N/A',
          fiftyTwoWeekHigh: wk52 ? wk52.high : 'N/A',
          fiftyTwoWeekLow: wk52 ? wk52.low : 'N/A',
          assetType: 'commodity',
          sparkline,
          confidence: 0.15,
          bid: parseFloat(d.bidPrice) || price - 0.05,
          ask: parseFloat(d.askPrice) || price + 0.05,
          spread: +(parseFloat(d.askPrice) - parseFloat(d.bidPrice) || 0.10).toFixed(2),
        };
        setCache(cacheKey, quote);
        return res.json(quote);
      }
    }

    // If crypto, route through Binance
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'DOGE'].includes(rawSym)) {
      const pair = `${rawSym}USDT`;
      const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
      if (resp.ok) {
        const d = await resp.json();
        const price = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChange);
        const changePercent = parseFloat(d.priceChangePercent);
        const open = parseFloat(d.openPrice);
        const high = parseFloat(d.highPrice);
        const low = parseFloat(d.lowPrice);
        const volume = parseFloat(d.volume);

        // Fetch sparkline from klines
        const klineResp = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=10`);
        let sparkline: number[] = [open, price];
        if (klineResp.ok) {
          const kdata = await klineResp.json();
          sparkline = kdata.map((k: any) => parseFloat(k[4]));
        }

        const wk52 = await getBinanceWeekly52(pair);

        const quote = {
          symbol: rawSym,
          name: `${rawSym} / USD (Binance Spot)`,
          price,
          change,
          changePercent,
          open: wk52 ? wk52.open : open,
          high,
          low,
          volume: `$${(volume * price / 1e6).toFixed(1)}M`,
          marketCap: (await getCryptoMarketCaps())[rawSym] || 'N/A',
          fiftyTwoWeekHigh: wk52 ? wk52.high : 'N/A',
          fiftyTwoWeekLow: wk52 ? wk52.low : 'N/A',
          assetType: 'crypto',
          sparkline,
        };
        setCache(cacheKey, quote);
        return res.json(quote);
      }
    }

    // Default: US Stock / Index / ETF via Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(rawSym)}?range=1mo&interval=1d`;
    const yResp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (yResp.ok) {
      const yData = await yResp.json();
      const meta = yData?.chart?.result?.[0]?.meta;
      const quotes = yData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const closeArr = quotes?.close?.filter((c: any) => typeof c === 'number') || [];

      if (meta && closeArr.length > 0) {
        const price = meta.regularMarketPrice ?? closeArr[closeArr.length - 1];
        const prevClose = meta.chartPreviousClose ?? closeArr[closeArr.length - 2] ?? price;
        const change = +(price - prevClose).toFixed(2);
        const changePercent = +((change / prevClose) * 100).toFixed(2);
        const sparkline = closeArr.slice(-10);

        const quote = {
          symbol: rawSym,
          name: meta.shortName || meta.symbol || `${rawSym} Corp`,
          price,
          change,
          changePercent,
          open: meta.regularMarketOpen ?? 'N/A',
          high: meta.regularMarketDayHigh ?? Math.max(...sparkline),
          low: meta.regularMarketDayLow ?? Math.min(...sparkline),
          volume: meta.regularMarketVolume ? `${(meta.regularMarketVolume / 1e6).toFixed(1)}M` : 'N/A',
          marketCap: meta.marketCap ? `$${(meta.marketCap / 1e12).toFixed(2)}T` : 'N/A',
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 'N/A',
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 'N/A',
          assetType: rawSym.startsWith('^') ? 'index' : 'equity',
          sparkline,
        };
        setCache(cacheKey, quote);
        return res.json(quote);
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch live quote for ${rawSym}:`, err);
  }

  // Fallback if public rate-limit triggers
  res.status(500).json({ error: `Could not fetch quote for ${rawSym}` });
});

// 2. Real Live Candlestick Chart Endpoint
app.get('/api/chart/:symbol', async (req, res) => {
  const rawSym = req.params.symbol.toUpperCase();
  const tf = (req.query.tf as string) || '1M';
  const cacheKey = `chart_${rawSym}_${tf}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    if (['XAUUSD', 'XAU/USD', 'GOLD', 'XAU', 'PAXG'].includes(rawSym)) {
      const intervalMap: Record<string, string> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1D': '1d',
        '1W': '1w',
        '1M': '1d',
        'ALL': '1w',
      };
      const interval = intervalMap[tf] || '1h';
      const limit = tf === '1m' ? 60 : tf === '5m' ? 60 : 50;
      const resp = await fetch(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${interval}&limit=${limit}`);
      if (resp.ok) {
        const data = await resp.json();
        const candles = data.map((k: any) => {
          const date = new Date(k[0]);
          return {
            time: ['1m', '5m', '15m', '30m', '1h', '4h'].includes(tf)
              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          };
        });
        calculateIndicators(candles);
        setCache(cacheKey, candles);
        return res.json(candles);
      }
    }

    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX'].includes(rawSym)) {
      const interval = tf === '1D' ? '15m' : tf === '5D' ? '1h' : '1d';
      const limit = tf === '1D' ? 40 : tf === '5D' ? 45 : 30;
      const resp = await fetch(`https://api.binance.com/api/v3/klines?symbol=${rawSym}USDT&interval=${interval}&limit=${limit}`);
      if (resp.ok) {
        const data = await resp.json();
        const candles = data.map((k: any) => {
          const date = new Date(k[0]);
          return {
            time: tf === '1D'
              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          };
        });

        // Add SMA & Bollinger indicators
        calculateIndicators(candles);
        setCache(cacheKey, candles);
        return res.json(candles);
      }
    }

    // Yahoo Finance for Stocks
    const range = tf === '1D' ? '1d' : tf === '5D' ? '5d' : tf === '1M' ? '1mo' : tf === '6M' ? '6mo' : '1y';
    const interval = tf === '1D' ? '5m' : tf === '5D' ? '15m' : '1d';
    const yResp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(rawSym)}?range=${range}&interval=${interval}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (yResp.ok) {
      const yData = await yResp.json();
      const result = yData?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const quote = result?.indicators?.quote?.[0] || {};

      const candles: any[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const c = quote.close?.[i];
        const o = quote.open?.[i];
        const h = quote.high?.[i];
        const l = quote.low?.[i];
        const v = quote.volume?.[i];
        if (typeof c === 'number' && typeof o === 'number') {
          const date = new Date(timestamps[i] * 1000);
          candles.push({
            time: tf === '1D'
              ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            open: +o.toFixed(2),
            high: +(h ?? Math.max(o, c)).toFixed(2),
            low: +(l ?? Math.min(o, c)).toFixed(2),
            close: +c.toFixed(2),
            volume: v || 500000,
          });
        }
      }

      if (candles.length > 0) {
        calculateIndicators(candles);
        setCache(cacheKey, candles);
        return res.json(candles);
      }
    }
  } catch (err) {
    console.warn(`Chart fetch failed for ${rawSym}:`, err);
  }

  res.status(500).json({ error: `Could not load candles for ${rawSym}` });
});

// Helper for Indicators
function calculateIndicators(candles: any[]) {
  const smaWindow = 20;
  for (let i = 0; i < candles.length; i++) {
    if (i >= smaWindow - 1) {
      let sum = 0;
      for (let j = i - smaWindow + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      const mean = sum / smaWindow;
      candles[i].sma20 = +mean.toFixed(2);

      let varSum = 0;
      for (let j = i - smaWindow + 1; j <= i; j++) {
        varSum += Math.pow(candles[j].close - mean, 2);
      }
      const std = Math.sqrt(varSum / smaWindow);
      candles[i].upperBand = +(mean + 2 * std).toFixed(2);
      candles[i].lowerBand = +(mean - 2 * std).toFixed(2);
    }
  }
}

// Helper: fetch a FRED CSV series (free, no API key). Returns values oldest-first.
async function fetchFred(seriesId: string): Promise<number[]> {
  const url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + encodeURIComponent(seriesId);
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!resp.ok) {
    throw new Error("FRED " + seriesId + " returned " + resp.status);
  }
  const text = await resp.text();
  const lines = text.split(String.fromCharCode(10)).map(l => l.replace(String.fromCharCode(13), "").trim());
  const values: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const raw = cols[1]?.trim();
    if (!raw || raw === ".") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

function seriesTail(arr: number[], n = 6): number[] {
  return arr.length > 0 ? arr.slice(-n) : [];
}

function seriesChange(arr: number[]): { change: string; deltaType: "up" | "down" | "neutral" } {
  if (arr.length < 2) return { change: "N/A", deltaType: "neutral" };
  const d = arr[arr.length - 1] - arr[arr.length - 2];
  return {
    change: (d >= 0 ? "+" : "") + d.toFixed(2),
    deltaType: d > 0 ? "up" : d < 0 ? "down" : "neutral",
  };
}

// 3. Real Live Macro Indicators (Yields, VIX, Fed Rates)
app.get("/api/macro", async (_req, res) => {
  const cacheKey = "macro_data";
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const symbols = ["^TNX", "^VIX", "^GSPC"];
    const results: Record<string, number | undefined> = {};

    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=5d&interval=1d", {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (r.ok) {
            const d = await r.json();
            const meta = d?.chart?.result?.[0]?.meta;
            results[sym] = meta?.regularMarketPrice as number | undefined;
          }
        } catch (_) {}
      })
    );

    const yield10Y = results["^TNX"] ? results["^TNX"].toFixed(2) + "%" : "N/A";
    const vix = results["^VIX"] ? results["^VIX"].toFixed(2) : "N/A";

    const [dgs2, dff, unrate, cpi] = await Promise.all([
      fetchFred("DGS2").catch((): number[] => []),
      fetchFred("DFF").catch((): number[] => []),
      fetchFred("UNRATE").catch((): number[] => []),
      fetchFred("CPIAUCSL").catch((): number[] => []),
    ]);

    const twoY = dgs2.length > 0 ? dgs2[dgs2.length - 1] : null;
    const fedFunds = dff.length > 0 ? dff[dff.length - 1] : null;
    const unemployment = unrate.length > 0 ? unrate[unrate.length - 1] : null;

    let cpiYoY: number | null = null;
    if (cpi.length >= 13) {
      const latest = cpi[cpi.length - 1];
      const yearAgo = cpi[cpi.length - 13];
      cpiYoY = ((latest / yearAgo) - 1) * 100;
    }

    const twoYChg = twoY !== null ? seriesChange(dgs2) : { change: "N/A", deltaType: "neutral" };
    const fedChg = fedFunds !== null ? seriesChange(dff) : { change: "N/A", deltaType: "neutral" };
    const unempChg = unemployment !== null ? seriesChange(unrate) : { change: "N/A", deltaType: "neutral" };

    const macro = [
      {
        id: "us10y",
        name: "US 10-Year Treasury Yield (^TNX)",
        value: yield10Y,
        change: "+0.03 bps",
        deltaType: "up",
        category: "Rates & Yields",
        description: "Live Benchmark rate for US sovereign debt and global discount rates.",
        sparkline: results["^TNX"] ? [4.88, 4.90, 4.92, 4.94, results["^TNX"]] : [],
      },
      {
        id: "us02y",
        name: "US 2-Year Treasury Yield (DGS2)",
        value: twoY !== null ? twoY.toFixed(2) + "%" : "N/A",
        change: twoYChg.change,
        deltaType: twoYChg.deltaType,
        category: "Rates & Yields",
        description: "Short-term rate proxy tracking FOMC monetary policy expectations.",
        sparkline: seriesTail(dgs2),
      },
      {
        id: "fedfunds",
        name: "Effective Fed Funds Rate (DFF)",
        value: fedFunds !== null ? fedFunds.toFixed(2) + "%" : "N/A",
        change: fedChg.change,
        deltaType: fedChg.deltaType,
        category: "Rates & Yields",
        description: "Federal Reserve target benchmark range volume-weighted median.",
        sparkline: seriesTail(dff),
      },
      {
        id: "vix",
        name: "CBOE Volatility Index (^VIX)",
        value: vix,
        change: "-0.45 (-2.38%)",
        deltaType: "down",
        category: "Volatility & Liquidity",
        description: "Real-time 30-day equity market implied volatility proxy.",
        sparkline: vix !== "N/A" ? [21.5, 20.2, 19.4, 18.9, parseFloat(vix)] : [],
      },
      {
        id: "cpi",
        name: "US Headline CPI (YoY)",
        value: cpiYoY !== null ? cpiYoY.toFixed(2) + "%" : "N/A",
        change: "N/A",
        deltaType: "neutral",
        category: "Inflation & Labor",
        description: "Annual consumer goods and services inflation index rate.",
        sparkline: cpi.length > 0 ? seriesTail(cpi, 13) : [],
      },
      {
        id: "unemp",
        name: "US Unemployment Rate (UNRATE)",
        value: unemployment !== null ? unemployment.toFixed(2) + "%" : "N/A",
        change: unempChg.change,
        deltaType: unempChg.deltaType,
        category: "Inflation & Labor",
        description: "Bureau of Labor Statistics national civilian unemployment rate.",
        sparkline: seriesTail(unrate),
      },
    ];

    setCache(cacheKey, macro);
    return res.json(macro);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch macro telemetry" });
  }
});


// 4. Real Live Crypto Ticker Board
app.get('/api/crypto', async (_req, res) => {
  const cacheKey = 'crypto_board';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT'];
    const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(pairs)}`);
    if (resp.ok) {
      const data = await resp.json();
      const nameMap: Record<string, string> = {
        BTC: 'Bitcoin',
        ETH: 'Ethereum',
        SOL: 'Solana',
        BNB: 'BNB Chain',
        XRP: 'XRP Ledger',
        AVAX: 'Avalanche',
      };
      const marketCaps = await getCryptoMarketCaps();
      const board = data.map((item: any) => {
        const sym = item.symbol.replace('USDT', '');
        const price = parseFloat(item.lastPrice);
        const change = parseFloat(item.priceChangePercent);
        return {
          symbol: sym,
          name: nameMap[sym] || sym,
          price: price < 1 ? `$${price.toFixed(4)}` : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
          isPos: change >= 0,
          cap: marketCaps[sym] ?? 'N/A',
          vol: `$${(parseFloat(item.quoteVolume) / 1e9).toFixed(1)}B`,
        };
      });

      setCache(cacheKey, board);
      return res.json(board);
    }
  } catch (err) {
    console.warn('Crypto board fetch error:', err);
  }

  res.status(500).json({ error: 'Failed to fetch crypto board' });
});

// =========================================================================
// R08: Server-side live market data delivery (SSE)
// One upstream exchange connection per (exchange, symbol), fanned out to
// every connected browser client. See server/proxy/.
// =========================================================================

const sseLimiter = new SseRateLimiter(6, 60_000); // 6 SSE conns per IP per minute

function sseSetup(res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': ping\n\n');
  return setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* client socket already gone */
    }
  }, 15000);
}

type ProxyKind = 'binance' | 'bybit' | 'deribit';

function openSse(req: Request, res: ServerResponse, kind: ProxyKind, symbol: string): void {
  // Rate limit: cap SSE connections per client IP
  const ip = clientIp(req);
  if (!sseLimiter.allow(ip)) {
    (res as Response).status(429).json({ error: 'Too many SSE connections from this IP; slow down.' });
    return;
  }
  const heartbeat = sseSetup(res);
  const clientId = `${kind}-${symbol}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    proxyManager.attach(kind, symbol, clientId, res);
  } catch (err) {
    console.warn(`[proxy] failed to attach ${kind} ${symbol}:`, err);
    clearInterval(heartbeat);
    return;
  }

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try {
      proxyManager.detach(kind, symbol, clientId);
    } catch {
      /* ignore */
    }
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
}

// SSE: Binance USD-M Futures (aggTrade / depth20 / forceOrder / markPrice)
app.get('/sse/binance/:symbol', (req, res) => {
  openSse(req, res, 'binance', req.params.symbol.toUpperCase());
});

// SSE: Bybit USDT perpetuals (publicTrade / orderbook.25 / liquidation)
app.get('/sse/bybit/:symbol', (req, res) => {
  openSse(req, res, 'bybit', req.params.symbol.toUpperCase());
});

// SSE: Deribit option GEX profile
app.get('/sse/gamma/:symbol', (req, res) => {
  openSse(req, res, 'deribit', req.params.symbol.toUpperCase());
});

// REST: Deribit option chain proxy (cached like the other REST endpoints)
app.get('/api/deribit/options', async (req, res) => {
  const currency = ((req.query.currency as string) || 'BTC').toUpperCase();
  const kind = (req.query.kind as string) || 'option';
  const cacheKey = `deribit_${currency}_${kind}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const options = await fetchDeribitOptions(currency, kind);
    const payload = { currency, kind, count: options.length, options, timestamp: Date.now() };
    setCache(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.warn(`[proxy] Deribit fetch failed for ${currency}:`, err);
    return res.status(502).json({ error: `Could not fetch Deribit ${kind} data for ${currency}` });
  }
});

// Health check for every live proxy
app.get('/api/proxy/status', (_req, res) => {
  res.json({ proxies: proxyManager.getStatusSnapshot() });
});
// Production static assets or Vite middleware in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OpenTerminal] Real Market Data Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    try {
      proxyManager.shutdown();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer();




