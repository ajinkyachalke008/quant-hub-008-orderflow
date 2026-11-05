import React, { useState, useEffect } from 'react';
import {
  Send,
  Bell,
  CheckCircle,
  XCircle,
  Trash2,
  ExternalLink,
  MessageSquare,
  Radio,
  Zap,
} from 'lucide-react';
import { webhookService } from '../../services/webhookService';
import { WebhookConfig, WebhookLogItem } from '../../types/terminal';

export const WebhookManagerWidget: React.FC = () => {
  const [config, setConfig] = useState<WebhookConfig>(() => webhookService.getConfig());
  const [logs, setLogs] = useState<WebhookLogItem[]>(() => webhookService.getLogs());
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    const unsub = webhookService.subscribe((c, l) => {
      setConfig(c);
      setLogs(l);
    });
    return unsub;
  }, []);

  const handleToggle = (field: keyof WebhookConfig) => {
    webhookService.updateConfig({ [field]: !config[field] });
  };

  const handleInputChange = (field: keyof WebhookConfig, value: string) => {
    webhookService.updateConfig({ [field]: value });
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestResult('');
    try {
      const res = await webhookService.sendTestNotification();
      if (res.discord || res.telegram || res.generic) {
        setTestResult('Ping dispatched successfully!');
      } else {
        setTestResult('Failed: Check token or webhook URL');
      }
    } catch {
      setTestResult('Error sending notification');
    } finally {
      setIsTesting(false);
      setTimeout(() => setTestResult(''), 4000);
    }
  };

  const handleClearLogs = () => {
    webhookService.clearLogs();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-color)] text-[var(--text-color)] text-xs font-mono select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-[var(--surface-elevated)] border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--accent-amber)]" />
          <span className="font-bold uppercase tracking-wider text-sm text-[var(--accent-amber)]">
            Webhooks & Telegram Alerts
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-[var(--text-muted)]">
            Live Push Integration
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer pr-2">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Master Dispatch:</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={() => handleToggle('enabled')}
              className="accent-[var(--accent-emerald)] w-3.5 h-3.5 cursor-pointer"
            />
          </label>

          <button
            onClick={handleSendTest}
            disabled={isTesting || (!config.discordWebhookUrl && !config.telegramBotToken)}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[var(--accent-cyan)]/20 hover:bg-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/50 font-bold transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTesting ? 'SENDING...' : 'TEST PING'}</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div className="px-3 py-1.5 bg-[var(--accent-cyan)]/15 border-b border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)] font-bold text-center text-xs animate-pulse">
          {testResult}
        </div>
      )}

      {/* Main Form & Delivery Audit Logs Split */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left Form Settings */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-3 overflow-y-auto space-y-3">
          {/* Telegram Settings */}
          <div className="space-y-2 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[var(--accent-cyan)] tracking-wider">
                1. Telegram Bot (Mobile Push)
              </span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[9px] text-[var(--accent-amber)] hover:underline flex items-center gap-1"
              >
                <span>Get Token (@BotFather)</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                Bot Token
              </label>
              <input
                type="password"
                placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={config.telegramBotToken || ''}
                onChange={(e) => handleInputChange('telegramBotToken', e.target.value)}
                className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[var(--accent-cyan)]"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                Target Chat ID (Personal or Channel)
              </label>
              <input
                type="text"
                placeholder="e.g. 987654321 or @my_trade_channel"
                value={config.telegramChatId || ''}
                onChange={(e) => handleInputChange('telegramChatId', e.target.value)}
                className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[var(--accent-cyan)]"
              />
            </div>
          </div>

          {/* Discord Settings */}
          <div className="space-y-2 pb-3 border-b border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-emerald)] tracking-wider block">
              2. Discord Server Webhook
            </span>
            <div>
              <label className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] block mb-0.5">
                Discord Webhook URL
              </label>
              <input
                type="password"
                placeholder="https://discord.com/api/webhooks/..."
                value={config.discordWebhookUrl || ''}
                onChange={(e) => handleInputChange('discordWebhookUrl', e.target.value)}
                className="w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[var(--accent-emerald)]"
              />
            </div>
          </div>

          {/* Event Triggers Checklist */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[var(--accent-amber)] tracking-wider block">
              3. Event Trigger Subscriptions
            </span>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnOrderFill}
                  onChange={() => handleToggle('notifyOnOrderFill')}
                  className="accent-[var(--accent-emerald)]"
                />
                <span>Order Executions</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnSlTpHit}
                  onChange={() => handleToggle('notifyOnSlTpHit')}
                  className="accent-[var(--accent-emerald)]"
                />
                <span>SL / TP Exits</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnPriceAlert}
                  onChange={() => handleToggle('notifyOnPriceAlert')}
                  className="accent-[var(--accent-emerald)]"
                />
                <span>Price Crossings</span>
              </label>

              <label className="flex items-center gap-2 p-1.5 rounded bg-[var(--surface-color)] border border-[var(--border-color)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnCircuitBreaker}
                  onChange={() => handleToggle('notifyOnCircuitBreaker')}
                  className="accent-[var(--accent-emerald)]"
                />
                <span>Circuit Breakers</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Audit Log Table */}
        <div className="flex flex-col bg-[var(--surface-elevated)] border border-[var(--border-color)] rounded p-2.5 overflow-hidden">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <span>Delivery Audit Log ({logs.length})</span>
            <button
              onClick={handleClearLogs}
              className="text-[#FF5252] hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[var(--surface-color)] border border-[var(--border-color)] space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {log.status === 'success' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--accent-emerald)]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#FF5252]" />
                      )}
                      <span className="font-bold uppercase text-[var(--accent-amber)]">
                        {log.type} / {log.event}
                      </span>
                    </div>
                    <span className="text-[var(--text-muted)]">{log.timestamp.slice(11, 19)} UTC</span>
                  </div>

                  <div className="text-[10px] text-[var(--text-color)] break-words whitespace-pre-wrap pl-5 opacity-90">
                    {log.payload.replace(/<[^>]*>?/gm, '')}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-[var(--text-muted)]">
                No webhook notifications dispatched yet. Enable master dispatch and send a test ping.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
