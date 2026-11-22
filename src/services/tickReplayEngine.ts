import { ReplayState, ReplayTick, TickReplayStats } from "../types/terminal";
import { xauusdService } from "./xauusdDataService";

const STORAGE_KEY = "openterminal_tick_replay_records_v1";
const MAX_BUFFER_SIZE = 10000;
const BINANCE_AGG_TRADES_URL = "https://api.binance.com/api/v3/aggTrades?symbol=PAXGUSDT&limit=500";

export type TickReplayListener = (tick: ReplayTick, stats: TickReplayStats) => void;

interface BinanceAggTrade {
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
}

class TickReplayEngine {
  private ticks: ReplayTick[] = [];
  private state: ReplayState = "IDLE";
  private currentIndex: number = 0;
  private playbackSpeed: 1 | 2 | 5 | 10 = 1;
  private timer: any = null;
  private listeners: Set<TickReplayListener> = new Set();
  private isRecording: boolean = true;
  private simulatedLatencyUs: number = 0;

  constructor() {
    this.loadPersistedTicks();
    this.hookLiveMarketTicks();
    this.seedFromRealHistoricalTrades();
  }

  private loadPersistedTicks() {
    if (typeof localStorage === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ticks = parsed.slice(-MAX_BUFFER_SIZE);
        }
      }
    } catch (e) {
      console.warn("Failed to load tick replay records:", e);
    }
  }

  private async seedFromRealHistoricalTrades() {
    if (this.ticks.length > 0) return;

    try {
      const resp = await fetch(BINANCE_AGG_TRADES_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.info("[TickReplayEngine] No historical trades returned from Binance; starting with empty buffer");
        return;
      }

      const historicalTicks: ReplayTick[] = data.map((trade: BinanceAggTrade, idx: number) => ({
        id: `hist_${trade.a}_${idx}`,
        timestamp: trade.T,
        price: parseFloat(trade.p),
        volume: parseFloat(trade.q),
        side: trade.m ? "sell" : "buy",
        source: "BINANCE HISTORICAL (PAXGUSDT)",
        confidence: 0.95,
      }));

      this.ticks = historicalTicks.slice(-MAX_BUFFER_SIZE);
      this.savePersistedTicks();
      this.notify();
    } catch (e) {
      console.warn("[TickReplayEngine] Failed to fetch real historical trades from Binance; starting with empty buffer:", e);
    }
  }

  private savePersistedTicks() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ticks.slice(-1000)));
    } catch (e) {
      console.warn("Failed to persist tick replay cache:", e);
    }
  }

  private hookLiveMarketTicks() {
    xauusdService.onPrice((tick) => {
      if (!this.isRecording || this.state === "PLAYING") return;

      const replayTick: ReplayTick = {
        id: `tick_${Date.now()}_${Math.min(9999, this.ticks.length + 1)}`,
        timestamp: tick.timestamp || Date.now(),
        price: tick.price,
        volume: parseFloat(tick.volume24h?.replace(/[^0-9.]/g, "") || "1.0"),
        side: tick.price >= (this.ticks[this.ticks.length - 1]?.price || tick.price) ? "buy" : "sell",
        source: tick.source,
        confidence: tick.confidence,
      };

      this.recordTick(replayTick);
    });
  }

  public recordTick(tick: ReplayTick) {
    this.ticks.push(tick);
    if (this.ticks.length > MAX_BUFFER_SIZE) {
      this.ticks.shift();
    }
    if (this.ticks.length % 25 === 0) {
      this.savePersistedTicks();
    }
  }

  public startRecording() {
    this.isRecording = true;
    if (this.state === "IDLE") {
      this.state = "RECORDING";
    }
    this.notify();
  }

  public stopRecording() {
    this.isRecording = false;
    if (this.state === "RECORDING") {
      this.state = "IDLE";
    }
    this.notify();
  }

  public play() {
    if (this.ticks.length === 0) return;
    this.state = "PLAYING";
    this.isRecording = false;

    if (this.currentIndex >= this.ticks.length - 1) {
      this.currentIndex = 0;
    }

    this.runPlaybackLoop();
    this.notify();
  }

  public pause() {
    this.state = "PAUSED";
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public stop() {
    this.state = "IDLE";
    this.currentIndex = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public stepForward() {
    if (this.currentIndex < this.ticks.length - 1) {
      this.currentIndex++;
      this.emitCurrentTick();
      this.notify();
    }
  }

  public stepBackward() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.emitCurrentTick();
      this.notify();
    }
  }

  public seekToIndex(index: number) {
    if (index >= 0 && index < this.ticks.length) {
      this.currentIndex = index;
      this.emitCurrentTick();
      this.notify();
    }
  }

  public setSpeed(speed: 1 | 2 | 5 | 10) {
    this.playbackSpeed = speed;
    if (this.state === "PLAYING") {
      if (this.timer) clearTimeout(this.timer);
      this.runPlaybackLoop();
    }
    this.notify();
  }

  private runPlaybackLoop() {
    if (this.state !== "PLAYING") return;

    if (this.currentIndex >= this.ticks.length - 1) {
      this.pause();
      return;
    }

    const currentTick = this.ticks[this.currentIndex];
    const nextTick = this.ticks[this.currentIndex + 1];

    let deltaMs = 500;
    if (nextTick && currentTick) {
      const realDelta = nextTick.timestamp - currentTick.timestamp;
      deltaMs = Math.max(50, Math.min(2000, realDelta));
    }

    const interval = Math.max(25, Math.floor(deltaMs / this.playbackSpeed));

    this.timer = setTimeout(() => {
      this.currentIndex++;
      this.emitCurrentTick();
      this.runPlaybackLoop();
    }, interval);
  }

  private emitCurrentTick() {
    const tick = this.ticks[this.currentIndex];
    if (!tick) return;

    const stats = this.getStats();
    this.listeners.forEach((l) => l(tick, stats));
  }

  public getStats(): TickReplayStats {
    const currentTick = this.ticks[this.currentIndex];
    const prevTick = this.ticks[Math.max(0, this.currentIndex - 1)];

    const delta = currentTick && prevTick ? Math.abs(currentTick.price - prevTick.price) : 0;
    const slippageBps = Number(((delta / (currentTick?.price || 4040)) * 10000).toFixed(2));

    return {
      totalRecorded: this.ticks.length,
      currentReplayIndex: this.currentIndex,
      playbackSpeed: this.playbackSpeed,
      startTime: this.ticks[0]?.timestamp || Date.now(),
      endTime: this.ticks[this.ticks.length - 1]?.timestamp || Date.now(),
      slippageEstimatedBps: slippageBps,
      simulatedLatencyUs: this.simulatedLatencyUs,
    };
  }

  public getState(): ReplayState {
    return this.state;
  }

  public getTicks(): ReplayTick[] {
    return [...this.ticks];
  }

  public getCurrentTick(): ReplayTick | null {
    return this.ticks[this.currentIndex] || null;
  }

  public subscribe(listener: TickReplayListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const tick = this.ticks[this.currentIndex];
    if (tick) {
      const stats = this.getStats();
      this.listeners.forEach((l) => l(tick, stats));
    }
  }

  public clearBuffer() {
    this.stop();
    this.ticks = [];
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.notify();
  }
}

export const tickReplayEngine = new TickReplayEngine();
