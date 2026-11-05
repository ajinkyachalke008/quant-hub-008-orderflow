import { LayoutMode, OverlayIndicator, PivotType, SubPaneIndicator, ThemeId, Timeframe } from '../types/terminal';
import { paperTradingEngine } from './paperTradingEngine';
import { alertEngine } from './alertEngine';
import { webhookService } from './webhookService';

export interface CommandContext {
  activeSymbol: string;
  setActiveSymbol: (s: string) => void;
  activeTheme: ThemeId;
  setTheme: (t: ThemeId) => void;
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
  scanlines: boolean;
  setScanlines: (on: boolean) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  watchlist: string[];
  addToWatchlist: (sym: string) => void;
  removeFromWatchlist: (sym: string) => void;
  clearLogs: () => void;
  fibonacciEnabled: boolean;
  setFibonacciEnabled: (on: boolean) => void;
  pivotType: PivotType;
  setPivotType: (p: PivotType) => void;
  overlayIndicators: OverlayIndicator[];
  toggleOverlayIndicator: (ind: OverlayIndicator) => void;
  subPaneIndicator: SubPaneIndicator | null;
  setSubPaneIndicator: (sub: SubPaneIndicator | null) => void;
  activePrice?: number;
}

export interface CommandResult {
  status: 'success' | 'error' | 'info';
  output: string;
}

/**
 * Exports full paper trading transaction history to a structured CSV file
 */
export function exportTradeJournalToCSV(): boolean {
  if (typeof window === 'undefined') return false;
  const { history, account } = paperTradingEngine.getFullState();

  const headers = [
    'Trade ID',
    'Symbol',
    'Side',
    'Lots',
    'Contract Size (oz)',
    'Entry Price ($)',
    'Exit Price ($)',
    'Realized PnL ($)',
    'Open Timestamp',
    'Close Timestamp',
    'Exit Trigger',
  ];

  const rows = history.map((h) => [
    h.id,
    h.symbol,
    h.side.toUpperCase(),
    h.lots,
    h.lots * 100,
    h.entryPrice.toFixed(2),
    h.exitPrice.toFixed(2),
    h.realizedPnl.toFixed(2),
    `"${h.openTime}"`,
    `"${h.closeTime}"`,
    h.reason.toUpperCase(),
  ]);

  const summary = [
    '',
    `Account Balance: $${account.balance.toFixed(2)}`,
    `Equity: $${account.equity.toFixed(2)}`,
    `Total Closed Trades: ${account.totalTrades}`,
    `Win Rate: ${account.winRate}%`,
    `Profit Factor: ${account.profitFactor}`,
    `Exported At: "${new Date().toISOString()}"`,
  ];

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(',')), ...summary].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `openterminal_trade_journal_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function executeCommand(cmdStr: string, ctx: CommandContext): CommandResult {
  const trimmed = cmdStr.trim();
  if (!trimmed) {
    return { status: 'info', output: '' };
  }

  const parts = trimmed.split(/\s+/);
  const root = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (root) {
    case 'help':
    case '?':
      return {
        status: 'info',
        output: [
          'OPENTERMINAL INSTITUTIONAL COMMAND SUITE:',
          '  --- MARKET EXECUTION & PAPER ORDERS ---',
          '  buy <lots> [sl <price>] [tp <price>]     - Market BUY (1 lot = 100 oz Gold @ 1:50 leverage)',
          '  sell <lots> [sl <price>] [tp <price>]    - Market SELL execution',
          '  limit buy|sell <lots> <targetPrice>      - Place pending limit order with auto fill',
          '  close all                                - Liquidate all open positions at market',
          '  positions                                - Display active positions and real-time P&L',
          '  account (or balance)                     - Inspect balance, equity, margin level %, free margin',
          '  reset paper                              - Reset paper trading balance to initial $100,000 USD',
          '  export csv                               - Export complete trade journal to downloadable CSV',
          '  alert <price> [note]                     - Set price crossing alert with synthesized Bloomberg chime',
          '  alerts                                   - List all active and triggered price alerts',
          '  --- CHARTING & WORKSPACE CONTROLS ---',
          '  xau (or gold)                            - Switch focus to XAU/USD Bullion Desk',
          '  symbol <sym>                             - Switch ticker focus (e.g. symbol BTC or symbol EUR/USD)',
          '  chart <sym> [timeframe]                  - Load chart timeframe (1m, 15m, 1h, 4h, 1D)',
          '  fib on|off                               - Toggle Auto-Fibonacci Retracement & Extensions',
          '  pivots [classic|camarilla|fibonacci|off] - Toggle Institutional Pivot Points',
          '  ind [sma|ema|bb|vwap|sar|rsi|macd|atr]   - Toggle technical overlays & oscillators',
          '  layout [default|xauusd|trading|macro]    - Switch terminal workspace layout',
          '  theme <name>                             - Switch theme: hybrid | bloomberg | wallstreet | retro',
          '  scanlines on|off                         - Toggle retro CRT phosphor glow overlay',
          '  snapshot                                 - Print / capture high-res workspace snapshot',
          '  clear                                    - Clear terminal console logs',
        ].join('\n'),
      };

    // Paper Trading Market Orders
    case 'buy': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: buy <LOTS> [sl <price>] [tp <price>] (e.g. buy 1.0 sl 4010 tp 4080)' };
      }
      const lots = parseFloat(args[0]);
      if (isNaN(lots) || lots <= 0) {
        return { status: 'error', output: 'Invalid lot size. Provide a positive number (e.g. buy 0.5).' };
      }

      let sl: number | undefined;
      let tp: number | undefined;
      for (let i = 1; i < args.length; i++) {
        if (args[i].toLowerCase() === 'sl' && args[i + 1]) {
          sl = parseFloat(args[i + 1]);
        }
        if (args[i].toLowerCase() === 'tp' && args[i + 1]) {
          tp = parseFloat(args[i + 1]);
        }
      }

      const res = paperTradingEngine.placeMarketOrder(ctx.activeSymbol, 'buy', lots, sl, tp);
      return {
        status: res.success ? 'success' : 'error',
        output: res.message,
      };
    }

    case 'sell': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: sell <LOTS> [sl <price>] [tp <price>] (e.g. sell 1.0 sl 4080 tp 4010)' };
      }
      const lots = parseFloat(args[0]);
      if (isNaN(lots) || lots <= 0) {
        return { status: 'error', output: 'Invalid lot size. Provide a positive number (e.g. sell 0.5).' };
      }

      let sl: number | undefined;
      let tp: number | undefined;
      for (let i = 1; i < args.length; i++) {
        if (args[i].toLowerCase() === 'sl' && args[i + 1]) {
          sl = parseFloat(args[i + 1]);
        }
        if (args[i].toLowerCase() === 'tp' && args[i + 1]) {
          tp = parseFloat(args[i + 1]);
        }
      }

      const res = paperTradingEngine.placeMarketOrder(ctx.activeSymbol, 'sell', lots, sl, tp);
      return {
        status: res.success ? 'success' : 'error',
        output: res.message,
      };
    }

    // Pending Limit Orders
    case 'limit': {
      const side = args[0]?.toLowerCase();
      if (side !== 'buy' && side !== 'sell') {
        return { status: 'error', output: 'Syntax: limit buy|sell <LOTS> <TARGET_PRICE> [sl <price>] [tp <price>]' };
      }
      const lots = parseFloat(args[1]);
      const targetPrice = parseFloat(args[2]);
      if (isNaN(lots) || lots <= 0 || isNaN(targetPrice) || targetPrice <= 0) {
        return { status: 'error', output: 'Invalid parameters. Example: limit buy 0.5 4015.00' };
      }

      let sl: number | undefined;
      let tp: number | undefined;
      for (let i = 3; i < args.length; i++) {
        if (args[i].toLowerCase() === 'sl' && args[i + 1]) sl = parseFloat(args[i + 1]);
        if (args[i].toLowerCase() === 'tp' && args[i + 1]) tp = parseFloat(args[i + 1]);
      }

      const res = paperTradingEngine.placeLimitOrder(ctx.activeSymbol, side as 'buy' | 'sell', lots, targetPrice, sl, tp);
      return {
        status: res.success ? 'success' : 'error',
        output: res.message,
      };
    }

    case 'close': {
      if (args[0]?.toLowerCase() === 'all') {
        const count = paperTradingEngine.closeAllPositions();
        return {
          status: 'success',
          output: `[OK] Closed ${count} active position(s) at current market price.`,
        };
      }
      if (args[0]) {
        const ok = paperTradingEngine.closePosition(args[0]);
        return {
          status: ok ? 'success' : 'error',
          output: ok ? `[OK] Position ${args[0]} closed.` : `Position ID "${args[0]}" not found.`,
        };
      }
      return { status: 'error', output: 'Syntax: close all OR close <POSITION_ID>' };
    }

    case 'positions':
    case 'pos': {
      const { positions } = paperTradingEngine.getFullState();
      if (positions.length === 0) {
        return { status: 'info', output: 'No active open positions. Type "buy 1.0" or "sell 0.5" to trade.' };
      }
      const lines = positions.map(
        (p) =>
          `• [${p.id}] ${p.side.toUpperCase()} ${p.lots} lots @ $${p.entryPrice.toFixed(2)} | Current: $${p.currentPrice.toFixed(2)} | PnL: ${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)} (${p.unrealizedPnlPercent}%) | Margin: $${p.marginUsed}`
      );
      return {
        status: 'info',
        output: `ACTIVE POSITIONS (${positions.length}):\n${lines.join('\n')}`,
      };
    }

    case 'account':
    case 'balance': {
      const { account } = paperTradingEngine.getFullState();
      return {
        status: 'info',
        output: [
          'INSTITUTIONAL ACCOUNT TELEMETRY (1:50 LEVERAGE):',
          `  Balance        : $${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `  Equity         : $${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `  Used Margin    : $${account.marginUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `  Free Margin    : $${account.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `  Margin Level   : ${account.marginLevel}% ${account.marginLevel < 100 && account.marginUsed > 0 ? '[MARGIN WARNING]' : '[SAFE]'}`,
          `  Leverage       : 1:${account.leverage}`,
          `  Total Trades   : ${account.totalTrades} | Win Rate: ${account.winRate}% | Profit Factor: ${account.profitFactor}`,
        ].join('\n'),
      };
    }

    case 'reset': {
      if (args[0]?.toLowerCase() === 'paper') {
        paperTradingEngine.resetAccount();
        return { status: 'success', output: '[OK] Paper trading account reset to initial $100,000.00 USD cash.' };
      }
      return { status: 'info', output: 'Use "reset paper" to reset virtual paper portfolio.' };
    }

    // Alerts
    case 'alert': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: alert <PRICE> [NOTE] (e.g. alert 4050 Resistance breakout)' };
      }
      const price = parseFloat(args[0]);
      if (isNaN(price) || price <= 0) {
        return { status: 'error', output: 'Invalid alert price.' };
      }
      const note = args.slice(1).join(' ');
      const a = alertEngine.addAlert(ctx.activeSymbol, price, note);
      return {
        status: 'success',
        output: `[OK] Alert set: ${ctx.activeSymbol} ${a.condition.replace('_', ' ')} $${price.toFixed(2)}${note ? ` ("${note}")` : ''}.`,
      };
    }

    case 'alerts': {
      const list = alertEngine.getAlerts();
      if (list.length === 0) {
        return { status: 'info', output: 'No active price alerts. Use "alert <PRICE>" to set one.' };
      }
      const lines = list.map(
        (a) =>
          `• [${a.id}] ${a.symbol} ${a.condition.replace('_', ' ')} $${a.targetPrice.toFixed(2)} | Status: ${a.triggered ? `TRIGGERED at ${a.triggeredAt}` : 'ACTIVE'}${a.note ? ` (${a.note})` : ''}`
      );
      return { status: 'info', output: `PRICE ALERTS (${list.length}):\n${lines.join('\n')}` };
    }

    // CSV Trade Journal Export
    case 'export': {
      if (args[0]?.toLowerCase() === 'csv') {
        exportTradeJournalToCSV();
        return {
          status: 'success',
          output: '[OK] Generated and downloaded trade journal CSV to local storage.',
        };
      }
      return { status: 'info', output: 'Use "export csv" to download your complete trade journal.' };
    }

    case 'snapshot': {
      if (typeof window !== 'undefined') {
        window.print();
        return { status: 'success', output: '[OK] Triggered high-resolution print & PDF snapshot.' };
      }
      return { status: 'error', output: 'Snapshot not supported in current environment.' };
    }

    case 'xau':
    case 'gold':
      ctx.setActiveSymbol('XAU/USD');
      ctx.setLayout('xauusd');
      return {
        status: 'success',
        output: '[OK] Switched focus to XAU/USD Bullion Desk (Pyth Hermes SSE + Binance Stream).',
      };

    case 'symbol':
    case 'sym': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: symbol <TICKER> (e.g. symbol XAU/USD or symbol BTC)' };
      }
      let sym = args[0].toUpperCase();
      if (['GOLD', 'XAU', 'XAUUSD'].includes(sym)) sym = 'XAU/USD';
      ctx.setActiveSymbol(sym);
      return { status: 'success', output: `[OK] Symbol focus set to ${sym}.` };
    }

    case 'q':
    case 'quote': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: quote <SYMBOL> (e.g., quote XAU/USD)' };
      }
      let sym = args[0].toUpperCase();
      if (['GOLD', 'XAU', 'XAUUSD'].includes(sym)) sym = 'XAU/USD';
      ctx.setActiveSymbol(sym);
      return { status: 'success', output: `[OK] Symbol focus set to ${sym}.` };
    }

    case 'chart': {
      if (!args[0]) {
        return { status: 'error', output: 'Syntax: chart <SYMBOL> [timeframe] (e.g., chart XAU/USD 15m)' };
      }
      let sym = args[0].toUpperCase();
      if (['GOLD', 'XAU', 'XAUUSD'].includes(sym)) sym = 'XAU/USD';
      ctx.setActiveSymbol(sym);
      if (args[1]) {
        ctx.setTimeframe(args[1] as Timeframe);
      }
      return { status: 'success', output: `[OK] Chart loaded for ${sym} (${args[1] || ctx.timeframe}).` };
    }

    case 'fib': {
      const state = args[0]?.toLowerCase();
      if (state === 'on') {
        ctx.setFibonacciEnabled(true);
        return { status: 'success', output: '[OK] Auto-Fibonacci Retracement & Extension grid: ON' };
      } else if (state === 'off') {
        ctx.setFibonacciEnabled(false);
        return { status: 'success', output: '[OK] Auto-Fibonacci Retracement & Extension grid: OFF' };
      }
      const next = !ctx.fibonacciEnabled;
      ctx.setFibonacciEnabled(next);
      return { status: 'success', output: `[OK] Auto-Fibonacci grid: ${next ? 'ON' : 'OFF'}` };
    }

    case 'pivots': {
      const p = args[0]?.toLowerCase() as PivotType;
      if (['classic', 'fibonacci', 'camarilla', 'off'].includes(p)) {
        ctx.setPivotType(p);
        return { status: 'success', output: `[OK] Pivot Points set to [${p.toUpperCase()}].` };
      }
      return { status: 'error', output: 'Valid pivot types: classic | fibonacci | camarilla | off' };
    }

    case 'ind': {
      const ind = args[0]?.toLowerCase() as OverlayIndicator;
      if (['sma20', 'sma50', 'sma200', 'ema9', 'ema21', 'ema50', 'ema200', 'bb', 'vwap', 'sar', 'volume'].includes(ind)) {
        ctx.toggleOverlayIndicator(ind);
        return { status: 'success', output: `[OK] Toggled overlay indicator: ${ind.toUpperCase()}` };
      }
      const sub = args[0]?.toLowerCase() as SubPaneIndicator;
      if (['rsi', 'macd', 'stoch', 'atr'].includes(sub)) {
        ctx.setSubPaneIndicator(ctx.subPaneIndicator === sub ? null : sub);
        return { status: 'success', output: `[OK] Oscillator sub-pane: ${sub.toUpperCase()}` };
      }
      return { status: 'error', output: 'Valid indicators: sma20, sma50, ema9, ema21, bb, vwap, rsi, macd, atr' };
    }

    case 'theme': {
      const t = args[0]?.toLowerCase() as ThemeId;
      if (['hybrid', 'bloomberg', 'wallstreet', 'retro'].includes(t)) {
        ctx.setTheme(t);
        return { status: 'success', output: `[OK] Theme activated: ${t.toUpperCase()}` };
      }
      return { status: 'error', output: 'Valid themes: hybrid | bloomberg | wallstreet | retro' };
    }

    case 'layout': {
      const l = args[0]?.toLowerCase() as LayoutMode;
      if (['default', 'xauusd', 'trading', 'macro', 'crypto', 'cli-focused'].includes(l)) {
        ctx.setLayout(l);
        return { status: 'success', output: `[OK] Workspace layout switched to [${l}].` };
      }
      return { status: 'error', output: 'Valid layouts: default, xauusd, trading, macro, crypto, cli-focused.' };
    }

    case 'scanlines':
    case 'crt': {
      if (!args[0]) {
        const next = !ctx.scanlines;
        ctx.setScanlines(next);
        return { status: 'success', output: `[OK] CRT scanlines: ${next ? 'ENABLED' : 'DISABLED'}` };
      }
      const enable = args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'true';
      ctx.setScanlines(enable);
      return { status: 'success', output: `[OK] CRT scanlines: ${enable ? 'ENABLED' : 'DISABLED'}` };
    }

    case 'oco': {
      // Syntax: oco <buy|sell> <limitPrice> <stopPrice> [lots]
      if (args.length < 3) {
        return { status: 'error', output: 'Syntax: oco <buy|sell> <limitPrice> <stopPrice> [lots=1.0]' };
      }
      const side = args[0].toLowerCase() as 'buy' | 'sell';
      const limitPrice = parseFloat(args[1]);
      const stopPrice = parseFloat(args[2]);
      const lots = args[3] ? parseFloat(args[3]) : 1.0;
      if (isNaN(limitPrice) || isNaN(stopPrice) || isNaN(lots)) {
        return { status: 'error', output: 'Invalid numbers for OCO order parameters.' };
      }
      const res = paperTradingEngine.placeOcoOrder(ctx.activeSymbol, side, lots, limitPrice, stopPrice);
      return { status: res.success ? 'success' : 'error', output: res.message };
    }

    case 'trailing': {
      // Syntax: trailing <lots> <trailOffset> [buy|sell]
      if (args.length < 2) {
        return { status: 'error', output: 'Syntax: trailing <lots> <trailOffsetInDollars> [buy|sell=buy]' };
      }
      const lots = parseFloat(args[0]);
      const trail = parseFloat(args[1]);
      const side = (args[2]?.toLowerCase() as 'buy' | 'sell') || 'buy';
      if (isNaN(lots) || isNaN(trail)) {
        return { status: 'error', output: 'Invalid parameters for trailing stop order.' };
      }
      const res = paperTradingEngine.placeMarketOrder(ctx.activeSymbol, side, lots, undefined, undefined, trail);
      return { status: res.success ? 'success' : 'error', output: res.message };
    }

    case 'iceberg': {
      // Syntax: iceberg <buy|sell> <totalLots> <visibleLots> [price]
      if (args.length < 3) {
        return { status: 'error', output: 'Syntax: iceberg <buy|sell> <totalLots> <visibleLots> [targetPrice]' };
      }
      const side = args[0].toLowerCase() as 'buy' | 'sell';
      const totalLots = parseFloat(args[1]);
      const visibleLots = parseFloat(args[2]);
      const price = args[3] ? parseFloat(args[3]) : (ctx.activePrice || 4040.0);
      if (isNaN(totalLots) || isNaN(visibleLots)) {
        return { status: 'error', output: 'Invalid numbers for Iceberg lots.' };
      }
      const res = paperTradingEngine.placeIcebergOrder(ctx.activeSymbol, side, totalLots, visibleLots, price);
      return { status: res.success ? 'success' : 'error', output: res.message };
    }

    case 'account':
    case 'vault': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'list') {
        const vaults = paperTradingEngine.getVaults();
        const state = paperTradingEngine.getFullState();
        return {
          status: 'info',
          output: [
            'PORTFOLIO SUB-ACCOUNT VAULTS:',
            ...vaults.map((v) => `  ${v.id === state.activeVaultId ? '▶ ' : '  '}${v.name} [1:${v.leverage}]: $${v.equity.toFixed(2)} (Drawdown limit: -${v.maxDailyDrawdownPercent}%)`),
          ].join('\n'),
        };
      }
      if (sub === 'switch' && args[1]) {
        const ok = paperTradingEngine.switchAccount(args[1]);
        return {
          status: ok ? 'success' : 'error',
          output: ok ? `Switched active trading vault to [${args[1]}].` : `Vault not found: "${args[1]}"`,
        };
      }
      if (sub === 'reset') {
        paperTradingEngine.resetAccount();
        return { status: 'success', output: 'Active vault reset to initial equity.' };
      }

      // Default: Print active account state
      const acc = paperTradingEngine.getFullState().account;
      return {
        status: 'info',
        output: [
          `ACTIVE VAULT: ${acc.name} (${acc.id})`,
          `  Balance       : $${acc.balance.toFixed(2)}`,
          `  Equity        : $${acc.equity.toFixed(2)}`,
          `  Margin Used   : $${acc.marginUsed.toFixed(2)} (Level: ${acc.marginLevel}%)`,
          `  Free Margin   : $${acc.freeMargin.toFixed(2)}`,
          `  Leverage      : 1:${acc.leverage}`,
          `  Daily Drawdown: ${(Math.max(0, acc.dailyStartingEquity - acc.equity) / acc.dailyStartingEquity * 100).toFixed(2)}% / Limit: -${acc.maxDailyDrawdownPercent}%`,
          `  Circuit Breaker: ${acc.isCircuitBreakerTripped ? 'TRIPPED (LOCKED)' : 'NORMAL'}`,
        ].join('\n'),
      };
    }

    case 'circuit': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'reset' || sub === 'unlock') {
        paperTradingEngine.resetCircuitBreaker();
        return { status: 'success', output: 'Circuit Breaker manually unlocked. Session equity reset.' };
      }
      const acc = paperTradingEngine.getFullState().account;
      return {
        status: acc.isCircuitBreakerTripped ? 'error' : 'success',
        output: `Circuit Breaker status: ${acc.isCircuitBreakerTripped ? 'TRIPPED (-' + acc.maxDailyDrawdownPercent + '% max daily loss hit). Type "circuit reset" to override.' : 'ACTIVE (Safe)'}`,
      };
    }

    case 'webhook': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'test') {
        const res = webhookService.sendTestNotification();
        return { status: 'info', output: 'Dispatched test notification ping to configured channels.' };
      }
      const cfg = webhookService.getConfig();
      return {
        status: 'info',
        output: [
          'WEBHOOK & TELEGRAM CONFIGURATION:',
          `  Master Enabled : ${cfg.enabled ? 'ON' : 'OFF'}`,
          `  Telegram Bot   : ${cfg.telegramBotToken ? 'CONFIGURED (' + cfg.telegramChatId + ')' : 'NONE'}`,
          `  Discord Webhook: ${cfg.discordWebhookUrl ? 'CONFIGURED' : 'NONE'}`,
        ].join('\n'),
      };
    }

    case 'status':
      return {
        status: 'info',
        output: [
          'OPENTERMINAL SYSTEM STATUS:',
          `  Active Symbol : ${ctx.activeSymbol}`,
          `  Theme Engine  : ${ctx.activeTheme.toUpperCase()} (CRT scanlines: ${ctx.scanlines ? 'ON' : 'OFF'})`,
          `  Layout Mode   : ${ctx.layout}`,
          '  XAU/USD Feed  : PYTH HERMES SSE + BINANCE WS (PAXG) [LIVE STREAMING]',
          '  Active Margin : 1:50 Institutional Model',
          '  Indicators    : ' + ctx.overlayIndicators.join(', '),
        ].join('\n'),
      };

    case 'clear':
    case 'cls':
      ctx.clearLogs();
      return { status: 'info', output: '' };

    default:
      return {
        status: 'error',
        output: `Command not recognized: "${trimmed}". Type "help" to explore all commands.`,
      };
  }
}
