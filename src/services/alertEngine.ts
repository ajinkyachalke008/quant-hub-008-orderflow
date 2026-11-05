import { PriceAlert } from '../types/terminal';
import { audioAlertService } from './audioAlertService';
import { webhookService } from './webhookService';

const STORAGE_KEY = 'openterminal_alerts_v2';

type AlertSubscriber = (alerts: PriceAlert[]) => void;

class AlertEngine {
  private alerts: PriceAlert[] = [];
  private subscribers: Set<AlertSubscriber> = new Set();
  private lastPrice: Record<string, number> = {};

  constructor() {
    this.alerts = this.loadAlerts();
  }

  public subscribe(cb: AlertSubscriber): () => void {
    this.subscribers.add(cb);
    cb([...this.alerts]);
    return () => this.subscribers.delete(cb);
  }

  public getAlerts(): PriceAlert[] {
    return [...this.alerts];
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb([...this.alerts]);
      } catch {}
    });
    this.saveAlerts();
  }

  private loadAlerts(): PriceAlert[] {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  private saveAlerts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alerts));
    } catch {}
  }

  public addAlert(symbol: string, targetPrice: number, note?: string): PriceAlert {
    const current = this.lastPrice[symbol] || targetPrice;
    const condition = targetPrice >= current ? 'crosses_above' : 'crosses_below';

    const alert: PriceAlert = {
      id: `alert_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0))}`,
      symbol,
      targetPrice: Number(targetPrice.toFixed(2)),
      condition,
      triggered: false,
      createdAt: new Date().toISOString(),
      note,
    };

    this.alerts.unshift(alert);
    audioAlertService.playBloombergChime();
    this.notify();
    return alert;
  }

  public removeAlert(id: string): boolean {
    const idx = this.alerts.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.alerts.splice(idx, 1);
    this.notify();
    return true;
  }

  public clearAll() {
    this.alerts = [];
    this.notify();
  }

  public onPriceTick(symbol: string, currentPrice: number) {
    if (!currentPrice || currentPrice <= 0) return;
    const prevPrice = this.lastPrice[symbol];
    this.lastPrice[symbol] = currentPrice;

    if (!prevPrice) return;

    let triggeredAny = false;
    this.alerts.forEach((alert) => {
      if (alert.triggered || alert.symbol !== symbol) return;

      let hit = false;
      if (alert.condition === 'crosses_above') {
        if (prevPrice < alert.targetPrice && currentPrice >= alert.targetPrice) {
          hit = true;
        }
      } else if (alert.condition === 'crosses_below') {
        if (prevPrice > alert.targetPrice && currentPrice <= alert.targetPrice) {
          hit = true;
        }
      }

      if (hit) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        triggeredAny = true;
        webhookService.dispatchPriceAlert(alert, currentPrice);
      }
    });

    if (triggeredAny) {
      audioAlertService.playPriceAlert();
      this.notify();
    }
  }
}

export const alertEngine = new AlertEngine();
