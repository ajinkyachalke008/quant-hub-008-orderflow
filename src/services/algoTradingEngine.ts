import {
  AlgoBotConfig,
  AlgoBotLog,
  AlgoBotTelemetry,
  AlgoStrategyId,
} from '../types/terminal';
import { paperTradingEngine } from './paperTradingEngine';
import { audioAlertService } from './audioAlertService';

const STORAGE_KEYS = {
  BOTS: 'openterminal_algo_bots_v3',
  LOGS: 'openterminal_algo_logs_v3',
};

const DEFAULT_BOTS: AlgoBotConfig[] = [
  {
    id: 'bot_vwap',
    name: 'VWAP Institutional Mean-Reversion',
    strategy: 'vwap_reversion',
    enabled: true,
    symbol: 'XAU/USD',
    lotSize: 0.5,
    maxPositions: 2,
    vwapSdThreshold: 1.5,
    stopLossDollars: 8.0,
    takeProfitDollars: 12.0,
  },
  {
    id: 'bot_breakout',
    name: 'Session Liquidity Breakout (PDH/PDL)',
    strategy: 'momentum_breakout',
    enabled: false,
    symbol: 'XAU/USD',
    lotSize: 0.5,
    maxPositions: 1,
    stopLossDollars: 6.0,
    takeProfitDollars: 15.0,
  },
];

type AlgoSubscriber = (bots: AlgoBotConfig[], logs: AlgoBotLog[], telemetry: AlgoBotTelemetry) => void;

class AlgoTradingEngine {
  private bots: AlgoBotConfig[] = [];
  private logs: AlgoBotLog[] = [];
  private subscribers: Set<AlgoSubscriber> = new Set();
  private isHalted: boolean = false;
  private worker: Worker | null = null;
  private lastEvaluatedPrice: number = 0;
  private lastSignalTime: number = 0;

  constructor() {
    this.bots = this.loadBots();
    this.logs = this.loadLogs();
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('../workers/strategyWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (e) => {
          const { type, strategy, side, price, reason, sl, tp, message } = e.data;
          if (type === 'ORDER_SIGNAL' && !this.isHalted) {
            this.handleAutomatedSignal(strategy, side, price, reason, sl, tp);
          } else if (type === 'LOG') {
            this.addLog({
              botId: 'system',
              strategy: 'worker',
              action: 'SCAN',
              message,
            });
          }
        };

        this.worker.onerror = () => {
          this.worker = null;
        };
      }
    } catch {
      this.worker = null;
    }
  }

  public subscribe(cb: AlgoSubscriber): () => void {
    this.subscribers.add(cb);
    cb([...this.bots], [...this.logs], this.getTelemetry());
    return () => this.subscribers.delete(cb);
  }

  public getTelemetry(): AlgoBotTelemetry {
    const full = paperTradingEngine.getFullState();
    const botTrades = full.history.filter((h) => h.reason === 'sl' || h.reason === 'tp' || h.reason === 'trailing_sl');
    const wins = botTrades.filter((t) => t.realizedPnl > 0);
    const totalPnl = botTrades.reduce((acc, t) => acc + t.realizedPnl, 0);

    return {
      totalTrades: botTrades.length,
      winningTrades: wins.length,
      winRate: botTrades.length > 0 ? +((wins.length / botTrades.length) * 100).toFixed(1) : 0,
      realizedPnl: +totalPnl.toFixed(2),
      activePositionsCount: full.positions.length,
      status: this.isHalted ? 'HALTED' : this.bots.some((b) => b.enabled) ? 'ACTIVE' : 'PAUSED',
    };
  }

  public toggleBot(id: string) {
    const b = this.bots.find((item) => item.id === id);
    if (b) {
      b.enabled = !b.enabled;
      this.saveBots();
      this.notify();
      this.addLog({
        botId: b.id,
        strategy: b.strategy,
        action: 'SCAN',
        message: `Bot status changed: ${b.enabled ? 'ENABLED' : 'PAUSED'}`,
      });
    }
  }

  public emergencyKillSwitch() {
    this.isHalted = true;
    this.bots.forEach((b) => (b.enabled = false));
    this.saveBots();
    const closedCount = paperTradingEngine.closeAllPositions();
    audioAlertService.playPriceAlert();

    this.addLog({
      botId: 'KILL_SWITCH',
      strategy: 'emergency',
      action: 'RISK_HALT',
      message: `EMERGENCY KILL SWITCH ENGAGED! All bots halted and ${closedCount} active positions liquidated.`,
    });
    this.notify();
  }

  public resumeOperations() {
    this.isHalted = false;
    this.bots[0].enabled = true;
    this.saveBots();
    this.addLog({
      botId: 'KILL_SWITCH',
      strategy: 'emergency',
      action: 'SCAN',
      message: 'System unhalted. Algorithmic execution resumed.',
    });
    this.notify();
  }

  private addLog(log: Omit<AlgoBotLog, 'id' | 'timestamp'>) {
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
    const item: AlgoBotLog = {
      ...log,
      id: `algo_log_${Date.now()}_${uid}`,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(item);
    if (this.logs.length > 80) this.logs.pop();
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
    } catch {}
    this.notify();
  }

  private notify() {
    const telemetry = this.getTelemetry();
    this.subscribers.forEach((cb) => {
      try {
        cb([...this.bots], [...this.logs], telemetry);
      } catch (_) {}
    });
  }

  private loadBots(): AlgoBotConfig[] {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.BOTS);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_BOTS.map((b) => ({ ...b }));
  }

  private saveBots() {
    try {
      localStorage.setItem(STORAGE_KEYS.BOTS, JSON.stringify(this.bots));
    } catch {}
  }

  private loadLogs(): AlgoBotLog[] {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.LOGS);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  /**
   * Evaluates bots on incoming market data tick
   */
  public onTick(
    symbol: string,
    currentPrice: number,
    vwap?: number,
    vwapSd?: number,
    pdh?: number,
    pdl?: number,
    volume?: number,
    avgVolume?: number
  ) {
    if (this.isHalted || !currentPrice || currentPrice <= 0) return;
    this.lastEvaluatedPrice = currentPrice;

    // Dispatch to Web Worker if active
    if (this.worker) {
      this.worker.postMessage({
        type: 'EVALUATE_TICK',
        payload: {
          price: currentPrice,
          timestamp: Date.now(),
          vwap,
          vwapSd,
          pdh,
          pdl,
          volume,
          avgVolume,
        },
      });
      return;
    }

    // Direct synchronous fallback if Worker was blocked
    const now = Date.now();
    if (now - this.lastSignalTime < 60000) return;

    for (const bot of this.bots) {
      if (!bot.enabled || bot.symbol !== symbol) continue;

      if (bot.strategy === 'vwap_reversion' && vwap && vwapSd && vwapSd > 0) {
        const z = (currentPrice - vwap) / vwapSd;
        const thresh = bot.vwapSdThreshold || 1.5;

        if (z <= -thresh) {
          this.lastSignalTime = now;
          this.handleAutomatedSignal(
            bot.strategy,
            'buy',
            currentPrice,
            `VWAP Oversold Deviation (Z: ${z.toFixed(2)} SD)`,
            +(currentPrice - vwapSd * 1.5).toFixed(2),
            +vwap.toFixed(2)
          );
          break;
        } else if (z >= thresh) {
          this.lastSignalTime = now;
          this.handleAutomatedSignal(
            bot.strategy,
            'sell',
            currentPrice,
            `VWAP Overbought Deviation (Z: +${z.toFixed(2)} SD)`,
            +(currentPrice + vwapSd * 1.5).toFixed(2),
            +vwap.toFixed(2)
          );
          break;
        }
      } else if (bot.strategy === 'momentum_breakout' && pdh && pdl && volume && avgVolume) {
        const volSurge = volume >= avgVolume * 1.3;
        if (currentPrice > pdh && volSurge) {
          this.lastSignalTime = now;
          this.handleAutomatedSignal(
            bot.strategy,
            'buy',
            currentPrice,
            `PDH Institutional Breakout (Volume ${(volume / avgVolume).toFixed(1)}x)`,
            +(pdh - 4.5).toFixed(2),
            +(currentPrice + 12.0).toFixed(2)
          );
          break;
        } else if (currentPrice < pdl && volSurge) {
          this.lastSignalTime = now;
          this.handleAutomatedSignal(
            bot.strategy,
            'sell',
            currentPrice,
            `PDL Institutional Breakdown (Volume ${(volume / avgVolume).toFixed(1)}x)`,
            +(pdl + 4.5).toFixed(2),
            +(currentPrice - 12.0).toFixed(2)
          );
          break;
        }
      }
    }
  }

  private handleAutomatedSignal(
    strategy: AlgoStrategyId,
    side: 'buy' | 'sell',
    price: number,
    reason: string,
    sl?: number,
    tp?: number
  ) {
    const bot = this.bots.find((b) => b.strategy === strategy);
    if (!bot || !bot.enabled) return;

    const full = paperTradingEngine.getFullState();
    if (full.positions.length >= (bot.maxPositions || 2)) {
      this.addLog({
        botId: bot.id,
        strategy,
        action: 'SCAN',
        message: `Signal generated (${side.toUpperCase()}) but skipped: Max concurrent bot positions reached (${bot.maxPositions}).`,
      });
      return;
    }

    const res = paperTradingEngine.placeMarketOrder(bot.symbol, side, bot.lotSize, sl, tp);
    if (res.success) {
      audioAlertService.playOrderExecuted();
      this.addLog({
        botId: bot.id,
        strategy,
        action: 'ENTRY',
        price,
        message: `AUTO-EXECUTION: ${side.toUpperCase()} ${bot.lotSize} lots @ $${price.toFixed(2)} | Reason: ${reason}`,
      });
    } else {
      this.addLog({
        botId: bot.id,
        strategy,
        action: 'RISK_HALT',
        message: `Auto-order rejected by risk desk: ${res.message}`,
      });
    }
  }
}

export const algoTradingEngine = new AlgoTradingEngine();
