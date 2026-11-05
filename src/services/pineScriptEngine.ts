import { Candle, CustomPineScript, PineHline, PinePlot, PineScriptResult } from '../types/terminal';

const SCRIPTS_STORAGE_KEY = 'openterminal_pinescripts_v2';

export const DEFAULT_PINE_TEMPLATES: CustomPineScript[] = [
  {
    id: 'script_ema_ribbon',
    name: 'EMA Triple Ribbon (20, 50, 200)',
    code: `// OpenTerminal Pine Engine
fast = ta.ema(close, 20)
med = ta.ema(close, 50)
slow = ta.ema(close, 200)

plot(fast, title="Fast EMA 20", color="#00F0FF")
plot(med, title="Med EMA 50", color="#FFB000")
plot(slow, title="Slow EMA 200", color="#FF5252")`,
  },
  {
    id: 'script_rsi_zones',
    name: 'RSI Oscillator & Overbought/Oversold',
    code: `// Dynamic RSI with Overbought / Oversold
rsi14 = ta.rsi(close, 14)

plot(rsi14, title="RSI (14)", color="#E040FB")
hline(70, title="Overbought", color="#FF5252", style="dashed")
hline(50, title="Neutral Midline", color="#78909C", style="dashed")
hline(30, title="Oversold", color="#00E676", style="dashed")`,
  },
  {
    id: 'script_atr_bands',
    name: 'ATR Volatility Envelope',
    code: `// ATR Volatility Bands
basis = ta.sma(close, 20)
atrVal = ta.atr(14)
upper = basis + (atrVal * 2)
lower = basis - (atrVal * 2)

plot(basis, title="Basis (20)", color="#FFB000")
plot(upper, title="Upper ATR Volatility", color="#00E676")
plot(lower, title="Lower ATR Volatility", color="#FF5252")`,
  },
];

export class PineScriptEngine {
  public static loadSavedScripts(): CustomPineScript[] {
    try {
      const s = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [...DEFAULT_PINE_TEMPLATES];
  }

  public static saveScripts(scripts: CustomPineScript[]) {
    try {
      localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
    } catch {}
  }

  /**
   * Execute Pine Script code against a verified OHLCV Candle series
   */
  public static execute(code: string, candles: Candle[]): PineScriptResult {
    const plots: PinePlot[] = [];
    const hlines: PineHline[] = [];
    const errors: string[] = [];
    const logs: string[] = [];

    if (!candles || candles.length === 0) {
      return { plots, hlines, errors: ['No candles loaded for script execution.'], logs };
    }

    const n = candles.length;
    const open = candles.map((c) => c.open);
    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const close = candles.map((c) => c.close);
    const volume = candles.map((c) => c.volume);

    // TA standard calculation functions
    const ta = {
      sma: (src: number[], len: number): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
          if (i >= len - 1) {
            let sum = 0;
            for (let j = i - len + 1; j <= i; j++) sum += src[j];
            res[i] = +(sum / len).toFixed(2);
          }
        }
        return res;
      },

      ema: (src: number[], len: number): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        const k = 2 / (len + 1);
        let prevEma: number | null = null;
        for (let i = 0; i < n; i++) {
          if (i === 0) {
            prevEma = src[0];
            res[i] = prevEma;
            const currentPrev: number = prevEma !== null ? prevEma : src[i];
            const val: number = src[i] * k + currentPrev * (1 - k);
            res[i] = +val.toFixed(2);
            prevEma = val;
          }
        }
        return res;
      },

      rsi: (src: number[], len: number = 14): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        if (n <= len) return res;

        let avgGain = 0;
        let avgLoss = 0;
        for (let i = 1; i <= len; i++) {
          const diff = src[i] - src[i - 1];
          if (diff >= 0) avgGain += diff;
          else avgLoss += Math.abs(diff);
        }
        avgGain /= len;
        avgLoss /= len;
        res[len] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);

        for (let i = len + 1; i < n; i++) {
          const diff = src[i] - src[i - 1];
          const gain = diff > 0 ? diff : 0;
          const loss = diff < 0 ? Math.abs(diff) : 0;
          avgGain = (avgGain * (len - 1) + gain) / len;
          avgLoss = (avgLoss * (len - 1) + loss) / len;
          res[i] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
        }
        return res;
      },

      atr: (len: number = 14): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        const trs: number[] = [high[0] - low[0]];
        for (let i = 1; i < n; i++) {
          const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
          trs.push(tr);
        }
        let sum = 0;
        for (let i = 0; i < len && i < n; i++) sum += trs[i];
        let atr = sum / Math.min(len, n);
        res[len - 1] = +atr.toFixed(2);

        for (let i = len; i < n; i++) {
          atr = (atr * (len - 1) + trs[i]) / len;
          res[i] = +atr.toFixed(2);
        }
        return res;
      },

      highest: (src: number[], len: number): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
          if (i >= len - 1) {
            let m = -Infinity;
            for (let j = i - len + 1; j <= i; j++) if (src[j] > m) m = src[j];
            res[i] = +m.toFixed(2);
          }
        }
        return res;
      },

      lowest: (src: number[], len: number): (number | null)[] => {
        const res: (number | null)[] = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
          if (i >= len - 1) {
            let m = Infinity;
            for (let j = i - len + 1; j <= i; j++) if (src[j] < m) m = src[j];
            res[i] = +m.toFixed(2);
          }
        }
        return res;
      },

      crossover: (a: (number | null)[], b: (number | null)[]): boolean[] => {
        return a.map((val, i) => {
          if (i === 0 || val === null || a[i - 1] === null || b[i] === null || b[i - 1] === null) return false;
          return a[i - 1]! <= b[i - 1]! && val > b[i]!;
        });
      },

      crossunder: (a: (number | null)[], b: (number | null)[]): boolean[] => {
        return a.map((val, i) => {
          if (i === 0 || val === null || a[i - 1] === null || b[i] === null || b[i - 1] === null) return false;
          return a[i - 1]! >= b[i - 1]! && val < b[i]!;
        });
      },
    };

    // Vectorized arithmetic helper
    const math = {
      abs: Math.abs,
      max: Math.max,
      min: Math.min,
      sqrt: Math.sqrt,
      pow: Math.pow,
    };

    // Plot callback handlers
    const plot = (
      series: (number | null)[] | number[],
      options?: { title?: string; color?: string; style?: 'line' | 'histogram' | 'cross' } | string
    ) => {
      let title = `Plot ${plots.length + 1}`;
      let color = plots.length === 0 ? '#00F0FF' : plots.length === 1 ? '#FFB000' : '#00E676';
      let style: 'line' | 'histogram' | 'cross' = 'line';

      if (typeof options === 'string') {
        title = options;
      } else if (options && typeof options === 'object') {
        if (options.title) title = options.title;
        if (options.color) color = options.color;
        if (options.style) style = options.style;
      }

      const values = Array.isArray(series) ? series : new Array(n).fill(series);
      plots.push({ title, color, values, style });
      logs.push(`Plot defined: "${title}" (${color})`);
    };

    const hline = (
      level: number,
      options?: { title?: string; color?: string; style?: 'dashed' | 'solid' } | string
    ) => {
      let title = `${level}`;
      let color = '#78909C';
      let style: 'dashed' | 'solid' = 'dashed';

      if (typeof options === 'string') {
        title = options;
      } else if (options && typeof options === 'object') {
        if (options.title) title = options.title;
        if (options.color) color = options.color;
        if (options.style) style = options.style;
      }

      hlines.push({ price: level, title, color, style });
      logs.push(`Hline defined: ${level} (${title})`);
    };

    // Safe execution context
    try {
      // Pre-process syntax to handle array elementwise operations
      // e.g. "basis + (atrVal * 2)" -> helper transformation
      const transformedCode = code
        .replace(/ta\.sma\(/g, '__ta.sma(')
        .replace(/ta\.ema\(/g, '__ta.ema(')
        .replace(/ta\.rsi\(/g, '__ta.rsi(')
        .replace(/ta\.atr\(/g, '__ta.atr(')
        .replace(/ta\.highest\(/g, '__ta.highest(')
        .replace(/ta\.lowest\(/g, '__ta.lowest(')
        .replace(/ta\.crossover\(/g, '__ta.crossover(')
        .replace(/ta\.crossunder\(/g, '__ta.crossunder(')
        .replace(/plot\(/g, '__plot(')
        .replace(/hline\(/g, '__hline(');

      const runner = new Function(
        '__ta',
        '__math',
        '__plot',
        '__hline',
        'open',
        'high',
        'low',
        'close',
        'volume',
        `
        const ta = __ta;
        const math = __math;
        const plot = (s, opt) => __plot(s, opt);
        const hline = (l, opt) => __hline(l, opt);
        
        // Elementwise vector math helpers
        function __add(a, b) {
          const res = [];
          for (let i = 0; i < ${n}; i++) {
            const v1 = Array.isArray(a) ? a[i] : a;
            const v2 = Array.isArray(b) ? b[i] : b;
            res.push(v1 !== null && v2 !== null ? +(v1 + v2).toFixed(2) : null);
          }
          return res;
        }
        function __sub(a, b) {
          const res = [];
          for (let i = 0; i < ${n}; i++) {
            const v1 = Array.isArray(a) ? a[i] : a;
            const v2 = Array.isArray(b) ? b[i] : b;
            res.push(v1 !== null && v2 !== null ? +(v1 - v2).toFixed(2) : null);
          }
          return res;
        }
        function __mul(a, b) {
          const res = [];
          for (let i = 0; i < ${n}; i++) {
            const v1 = Array.isArray(a) ? a[i] : a;
            const v2 = Array.isArray(b) ? b[i] : b;
            res.push(v1 !== null && v2 !== null ? +(v1 * v2).toFixed(2) : null);
          }
          return res;
        }

        try {
          ${transformedCode}
        } catch (err) {
          throw err;
        }
        `
      );

      runner(ta, math, plot, hline, open, high, low, close, volume);
    } catch (err: any) {
      errors.push(err?.message || 'Script syntax error');
    }

    return { plots, hlines, errors, logs };
  }
}
