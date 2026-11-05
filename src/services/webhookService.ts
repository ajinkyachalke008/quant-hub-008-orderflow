import { WebhookConfig, WebhookLogItem, PaperOrder, PaperPosition, PriceAlert } from '../types/terminal';

const CONFIG_STORAGE_KEY = 'openterminal_webhook_config_v2';
const LOGS_STORAGE_KEY = 'openterminal_webhook_logs_v2';

const DEFAULT_CONFIG: WebhookConfig = {
  enabled: false,
  discordWebhookUrl: '',
  genericWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  notifyOnOrderFill: true,
  notifyOnSlTpHit: true,
  notifyOnPriceAlert: true,
  notifyOnCircuitBreaker: true,
};

type WebhookSubscriber = (config: WebhookConfig, logs: WebhookLogItem[]) => void;

class WebhookService {
  private config: WebhookConfig;
  private logs: WebhookLogItem[] = [];
  private subscribers: Set<WebhookSubscriber> = new Set();

  constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();
  }

  public subscribe(cb: WebhookSubscriber): () => void {
    this.subscribers.add(cb);
    cb({ ...this.config }, [...this.logs]);
    return () => this.subscribers.delete(cb);
  }

  public getConfig(): WebhookConfig {
    return { ...this.config };
  }

  public getLogs(): WebhookLogItem[] {
    return [...this.logs];
  }

  public updateConfig(newConfig: Partial<WebhookConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.notify();
  }

  private notify() {
    this.subscribers.forEach((cb) => {
      try {
        cb({ ...this.config }, [...this.logs]);
      } catch (err) {
        console.error('Webhook subscriber error:', err);
      }
    });
  }

  private loadConfig(): WebhookConfig {
    try {
      const s = localStorage.getItem(CONFIG_STORAGE_KEY);
      return s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch {}
  }

  private loadLogs(): WebhookLogItem[] {
    try {
      const s = localStorage.getItem(LOGS_STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  }

  private addLog(item: Omit<WebhookLogItem, 'id' | 'timestamp'>) {
    const id = `wh_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0)}`;
    const logItem: WebhookLogItem = {
      ...item,
      id,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 50) this.logs.pop();
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs));
    } catch {}
    this.notify();
  }

  public clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem(LOGS_STORAGE_KEY);
    } catch {}
    this.notify();
  }

  /**
   * Send notification via Discord Webhook
   */
  private async sendDiscord(content: string, embedTitle: string, color: number = 0xffb000) {
    if (!this.config.discordWebhookUrl) return false;
    try {
      const body = {
        username: 'OpenTerminal Institutional',
        avatar_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&auto=format&fit=crop&q=80',
        content,
        embeds: [
          {
            title: embedTitle,
            description: content,
            color,
            footer: { text: 'OpenTerminal XAU/USD Execution Engine' },
            timestamp: new Date().toISOString(),
          },
        ],
      };
      const res = await fetch(this.config.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (e) {
      console.error('Discord webhook error:', e);
      return false;
    }
  }

  /**
   * Send direct push message via Telegram Bot API
   */
  private async sendTelegram(message: string): Promise<boolean> {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) return false;
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
      return res.ok;
    } catch (e) {
      console.error('Telegram bot error:', e);
      return false;
    }
  }

  /**
   * Send generic REST JSON payload
   */
  private async sendGeneric(payload: Record<string, any>): Promise<boolean> {
    if (!this.config.genericWebhookUrl) return false;
    try {
      const res = await fetch(this.config.genericWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (e) {
      console.error('Generic webhook error:', e);
      return false;
    }
  }

  /**
   * Dispatch Order Fill Event
   */
  public async dispatchOrderFill(order: PaperOrder, fillPrice: number) {
    if (!this.config.enabled || !this.config.notifyOnOrderFill) return;

    const sideText = order.side.toUpperCase();
    const formattedMsg = `<b>[ORDER FILLED]</b> ${sideText} ${order.lots.toFixed(2)} lots of ${order.symbol} @ $${fillPrice.toFixed(2)}\nType: ${order.type.toUpperCase()}${order.sl ? ` | SL: $${order.sl.toFixed(2)}` : ''}${order.tp ? ` | TP: $${order.tp.toFixed(2)}` : ''}`;

    let success = false;
    if (this.config.telegramBotToken) {
      const ok = await this.sendTelegram(formattedMsg);
      if (ok) success = true;
    }
    if (this.config.discordWebhookUrl) {
      const ok = await this.sendDiscord(
        `ORDER FILLED: ${sideText} ${order.lots} ${order.symbol} @ $${fillPrice.toFixed(2)}`,
        `Fill Confirmed — ${order.symbol}`,
        order.side === 'buy' ? 0x00e676 : 0xff5252
      );
      if (ok) success = true;
    }
    if (this.config.genericWebhookUrl) {
      await this.sendGeneric({ event: 'order_fill', order, fillPrice, timestamp: Date.now() });
    }

    this.addLog({
      type: this.config.telegramBotToken ? 'telegram' : 'discord',
      event: 'order_fill',
      status: success ? 'success' : 'failed',
      payload: formattedMsg,
    });
  }

  /**
   * Dispatch Stop-Loss / Take-Profit Hit Event
   */
  public async dispatchSlTpHit(pos: PaperPosition, exitPrice: number, reason: 'sl' | 'tp' | 'trailing_sl', pnl: number) {
    if (!this.config.enabled || !this.config.notifyOnSlTpHit) return;

    const isWin = pnl >= 0;
    const reasonLabel = reason === 'sl' ? 'STOP LOSS HIT' : reason === 'trailing_sl' ? 'TRAILING SL HIT' : 'TAKE PROFIT REACHED';
    const formattedMsg = `<b>[${reasonLabel}]</b> ${pos.symbol} (${pos.side.toUpperCase()} ${pos.lots} lots)\nExit: $${exitPrice.toFixed(2)} | Entry: $${pos.entryPrice.toFixed(2)}\nRealized PnL: ${isWin ? '+' : ''}$${pnl.toFixed(2)}`;

    let success = false;
    if (this.config.telegramBotToken) {
      const ok = await this.sendTelegram(formattedMsg);
      if (ok) success = true;
    }
    if (this.config.discordWebhookUrl) {
      const ok = await this.sendDiscord(
        `${reasonLabel}: ${pos.symbol} @ $${exitPrice.toFixed(2)} | PnL: ${isWin ? '+' : ''}$${pnl.toFixed(2)}`,
        `Position Closed — ${reasonLabel}`,
        isWin ? 0x00e676 : 0xff5252
      );
      if (ok) success = true;
    }
    if (this.config.genericWebhookUrl) {
      await this.sendGeneric({ event: reason === 'sl' ? 'sl_hit' : 'tp_hit', pos, exitPrice, pnl, reason });
    }

    this.addLog({
      type: this.config.telegramBotToken ? 'telegram' : 'discord',
      event: reason === 'sl' ? 'sl_hit' : 'tp_hit',
      status: success ? 'success' : 'failed',
      payload: formattedMsg,
    });
  }

  /**
   * Dispatch Price Alert Crossing Event
   */
  public async dispatchPriceAlert(alert: PriceAlert, currentPrice: number) {
    if (!this.config.enabled || !this.config.notifyOnPriceAlert) return;

    const conditionText = alert.condition === 'crosses_above' ? 'crossed above' : 'crossed below';
    const formattedMsg = `<b>[PRICE ALERT TRIGGERED]</b> ${alert.symbol} ${conditionText} target price $${alert.targetPrice.toFixed(2)} (Current: $${currentPrice.toFixed(2)})${alert.note ? `\nNote: ${alert.note}` : ''}`;

    let success = false;
    if (this.config.telegramBotToken) {
      const ok = await this.sendTelegram(formattedMsg);
      if (ok) success = true;
    }
    if (this.config.discordWebhookUrl) {
      const ok = await this.sendDiscord(
        `PRICE ALERT: ${alert.symbol} ${conditionText} $${alert.targetPrice.toFixed(2)}`,
        `Alert Fired: ${alert.symbol}`,
        0xffb000
      );
      if (ok) success = true;
    }

    this.addLog({
      type: this.config.telegramBotToken ? 'telegram' : 'discord',
      event: 'price_alert',
      status: success ? 'success' : 'failed',
      payload: formattedMsg,
    });
  }

  /**
   * Dispatch Daily Drawdown Circuit Breaker Event
   */
  public async dispatchCircuitBreaker(accountName: string, equity: number, drawdownPercent: number) {
    if (!this.config.enabled || !this.config.notifyOnCircuitBreaker) return;

    const formattedMsg = `<b>[CIRCUIT BREAKER TRIPPED]</b> Account: <b>${accountName}</b>\nDaily Drawdown exceeded limit: <b>-${drawdownPercent.toFixed(2)}%</b>\nCurrent Equity: $${equity.toFixed(2)}\n<i>All open positions have been liquidated and trading is locked for 24h to preserve capital.</i>`;

    let success = false;
    if (this.config.telegramBotToken) {
      const ok = await this.sendTelegram(formattedMsg);
      if (ok) success = true;
    }
    if (this.config.discordWebhookUrl) {
      const ok = await this.sendDiscord(
        `CIRCUIT BREAKER: ${accountName} drawdown -${drawdownPercent.toFixed(2)}% | Trading locked.`,
        `EMERGENCY CAPITAL PROTECTION TRIPPED`,
        0xff1744
      );
      if (ok) success = true;
    }

    this.addLog({
      type: this.config.telegramBotToken ? 'telegram' : 'discord',
      event: 'circuit_breaker',
      status: success ? 'success' : 'failed',
      payload: formattedMsg,
    });
  }

  /**
   * Send test notifications to all configured channels
   */
  public async sendTestNotification(): Promise<{ discord: boolean; telegram: boolean; generic: boolean }> {
    const results = { discord: false, telegram: false, generic: false };
    const testMsg = `<b>[OPENTERMINAL TEST]</b> Webhook and Bot Notification connection verified!\nTimestamp: ${new Date().toLocaleTimeString()} UTC`;

    if (this.config.telegramBotToken && this.config.telegramChatId) {
      results.telegram = await this.sendTelegram(testMsg);
    }
    if (this.config.discordWebhookUrl) {
      results.discord = await this.sendDiscord(
        `OpenTerminal Webhook Test at ${new Date().toLocaleTimeString()}`,
        'Webhook Diagnostics OK',
        0x00f0ff
      );
    }
    if (this.config.genericWebhookUrl) {
      results.generic = await this.sendGeneric({ event: 'test', timestamp: Date.now() });
    }

    const anySuccess = results.discord || results.telegram || results.generic;
    this.addLog({
      type: this.config.telegramBotToken ? 'telegram' : 'discord',
      event: 'test',
      status: anySuccess ? 'success' : 'failed',
      payload: `Test ping sent. Discord: ${results.discord ? 'OK' : 'N/A'}, Telegram: ${results.telegram ? 'OK' : 'N/A'}`,
    });

    return results;
  }
}

export const webhookService = new WebhookService();
