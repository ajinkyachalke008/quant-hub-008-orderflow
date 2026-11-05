import {
  PaperPosition,
  PaperOrder,
  PaperTradeJournalEntry,
  PaperAccountState,
  AccountVault,
  PaperOrderType,
} from '../types/terminal';
import { audioAlertService } from './audioAlertService';
import { webhookService } from './webhookService';
import { fixProtocolEngine } from './fixProtocolEngine';

const STORAGE_KEYS = {
  VAULTS: 'openterminal_vaults_v3',
  ACTIVE_VAULT_ID: 'openterminal_active_vault_id_v3',
};

const DEFAULT_VAULTS: AccountVault[] = [
  {
    id: 'acc_main',
    name: 'Main Institutional (Scalp)',
    balance: 100000,
    equity: 100000,
    marginUsed: 0,
    freeMargin: 100000,
    marginLevel: 0,
    leverage: 50,
    currency: 'USD',
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    initialBalance: 100000,
    dailyStartingEquity: 100000,
    maxDailyDrawdownPercent: 5.0,
    isCircuitBreakerTripped: false,
    circuitBreakerExpiry: null,
    positions: [],
    orders: [],
    history: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc_swing',
    name: 'Macro Swing Portfolio',
    balance: 250000,
    equity: 250000,
    marginUsed: 0,
    freeMargin: 250000,
    marginLevel: 0,
    leverage: 20,
    currency: 'USD',
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    initialBalance: 250000,
    dailyStartingEquity: 250000,
    maxDailyDrawdownPercent: 8.0,
    isCircuitBreakerTripped: false,
    circuitBreakerExpiry: null,
    positions: [],
    orders: [],
    history: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc_challenge',
    name: 'Prop Firm Challenge Vault',
    balance: 50000,
    equity: 50000,
    marginUsed: 0,
    freeMargin: 50000,
    marginLevel: 0,
    leverage: 100,
    currency: 'USD',
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    initialBalance: 50000,
    dailyStartingEquity: 50000,
    maxDailyDrawdownPercent: 4.0,
    isCircuitBreakerTripped: false,
    circuitBreakerExpiry: null,
    positions: [],
    orders: [],
    history: [],
    createdAt: new Date().toISOString(),
  },
];

const OUNCES_PER_LOT = 100; // Standard commodity contract (100 oz Gold)

type PaperSubscriber = (state: {
  account: PaperAccountState;
  positions: PaperPosition[];
  orders: PaperOrder[];
  history: PaperTradeJournalEntry[];
  vaults: AccountVault[];
  activeVaultId: string;
}) => void;

class PaperTradingEngine {
  private vaults: AccountVault[] = [];
  private activeVaultId: string = 'acc_main';
  private subscribers: Set<PaperSubscriber> = new Set();
  private lastKnownPrice: number = 4040.0;

  constructor() {
    this.vaults = this.loadVaults();
    this.activeVaultId = this.loadActiveVaultId();
  }

  private get activeVault(): AccountVault {
    let vault = this.vaults.find((v) => v.id === this.activeVaultId);
    if (!vault) {
      vault = this.vaults[0];
      this.activeVaultId = vault.id;
    }
    return vault;
  }

  public subscribe(cb: PaperSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.getFullState());
    return () => this.subscribers.delete(cb);
  }

  public getFullState() {
    const v = this.activeVault;
    return {
      account: {
        id: v.id,
        name: v.name,
        balance: v.balance,
        equity: v.equity,
        marginUsed: v.marginUsed,
        freeMargin: v.freeMargin,
        marginLevel: v.marginLevel,
        leverage: v.leverage,
        currency: v.currency,
        winRate: v.winRate,
        totalTrades: v.totalTrades,
        profitFactor: v.profitFactor,
        initialBalance: v.initialBalance,
        dailyStartingEquity: v.dailyStartingEquity,
        maxDailyDrawdownPercent: v.maxDailyDrawdownPercent,
        isCircuitBreakerTripped: v.isCircuitBreakerTripped,
        circuitBreakerExpiry: v.circuitBreakerExpiry,
      },
      positions: [...v.positions],
      orders: [...v.orders],
      history: [...v.history],
      vaults: [...this.vaults],
      activeVaultId: this.activeVaultId,
    };
  }

  public getVaults(): AccountVault[] {
    return [...this.vaults];
  }

  public getActiveVault(): AccountVault {
    return this.activeVault;
  }

  public switchAccount(id: string): boolean {
    const found = this.vaults.find((v) => v.id === id);
    if (!found) return false;
    this.activeVaultId = id;
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VAULT_ID, id);
    } catch {}
    this.notify();
    return true;
  }

  public createAccount(name: string, balance: number, leverage: number, maxDailyDrawdown: number = 5.0) {
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
    const newVault: AccountVault = {
      id: `acc_${Date.now()}_${uid}`,
      name: name.trim() || `Vault ${this.vaults.length + 1}`,
      balance: balance > 0 ? balance : 100000,
      equity: balance > 0 ? balance : 100000,
      marginUsed: 0,
      freeMargin: balance > 0 ? balance : 100000,
      marginLevel: 0,
      leverage: [10, 20, 50, 100].includes(leverage) ? leverage : 50,
      currency: 'USD',
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      initialBalance: balance,
      dailyStartingEquity: balance,
      maxDailyDrawdownPercent: maxDailyDrawdown,
      isCircuitBreakerTripped: false,
      circuitBreakerExpiry: null,
      positions: [],
      orders: [],
      history: [],
      createdAt: new Date().toISOString(),
    };

    this.vaults.push(newVault);
    this.activeVaultId = newVault.id;
    this.saveAll();
    this.notify();
  }

  public resetCircuitBreaker() {
    const v = this.activeVault;
    v.isCircuitBreakerTripped = false;
    v.circuitBreakerExpiry = null;
    v.dailyStartingEquity = v.equity;
    this.saveAll();
    this.notify();
  }

  private notify() {
    const state = this.getFullState();
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error('Paper subscriber error:', e);
      }
    });
    this.saveAll();
  }

  private loadVaults(): AccountVault[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VAULTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_VAULTS.map((v) => ({ ...v }));
  }

  private loadActiveVaultId(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_VAULT_ID);
      if (saved && this.vaults.some((v) => v.id === saved)) return saved;
    } catch {}
    return this.vaults[0]?.id || 'acc_main';
  }

  private saveAll() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.VAULTS, JSON.stringify(this.vaults));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VAULT_ID, this.activeVaultId);
    } catch (e) {
      console.warn('Failed to persist paper trading state:', e);
    }
  }

  /**
   * Called on every live price tick to update P&L, evaluate stop-loss/take-profit,
   * trailing stops, OCO fills, iceberg tranches, and daily drawdown circuit breakers.
   */
  public onPriceTick(symbol: string, currentPrice: number) {
    if (!currentPrice || currentPrice <= 0) return;
    this.lastKnownPrice = currentPrice;
    const v = this.activeVault;
    let stateChanged = false;

    // Check circuit breaker status expiration (24h lock)
    if (v.isCircuitBreakerTripped && v.circuitBreakerExpiry) {
      if (new Date().toISOString() > v.circuitBreakerExpiry) {
        v.isCircuitBreakerTripped = false;
        v.circuitBreakerExpiry = null;
        v.dailyStartingEquity = v.equity;
        stateChanged = true;
      }
    }

    // 1. Evaluate Pending Orders (Limit, OCO, Trailing, Iceberg)
    const remainingOrders: PaperOrder[] = [];
    const triggeredOcoGroupIds = new Set<string>();

    for (const order of v.orders) {
      if (order.status !== 'pending' || order.symbol !== symbol) {
        remainingOrders.push(order);
        continue;
      }

      // Check if sibling OCO was already filled in this cycle
      if (order.ocoGroupId && triggeredOcoGroupIds.has(order.ocoGroupId)) {
        order.status = 'cancelled';
        continue;
      }

      let filled = false;
      if (order.type === 'limit' || order.type === 'oco') {
        if (order.side === 'buy' && currentPrice <= order.targetPrice) filled = true;
        else if (order.side === 'sell' && currentPrice >= order.targetPrice) filled = true;
      } else if (order.type === 'stop') {
        if (order.side === 'buy' && currentPrice >= order.targetPrice) filled = true;
        else if (order.side === 'sell' && currentPrice <= order.targetPrice) filled = true;
      } else if (order.type === 'iceberg') {
        if (order.side === 'buy' && currentPrice <= order.targetPrice) filled = true;
        else if (order.side === 'sell' && currentPrice >= order.targetPrice) filled = true;
      }

      if (filled) {
        order.status = 'filled';
        stateChanged = true;

        if (order.type === 'iceberg') {
          // Execute visible tranche
          const trancheLots = order.visibleLots || order.lots;
          this.executeMarketOrderInternal(order.symbol, order.side, trancheLots, currentPrice, order.sl, order.tp);
          audioAlertService.playOrderExecuted();
          webhookService.dispatchOrderFill(order, currentPrice);

          const executed = (order.executedLots || 0) + trancheLots;
          const total = order.totalLots || order.lots;

          // If more tranches remain, replenish next visible tranche
          if (executed < total) {
            const nextLots = Math.min(trancheLots, +(total - executed).toFixed(2));
            const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
            remainingOrders.push({
              ...order,
              id: `ord_iceberg_${Date.now()}_${uid}`,
              lots: nextLots,
              executedLots: executed,
              status: 'pending',
            });
          }
        } else {
          this.executeMarketOrderInternal(order.symbol, order.side, order.lots, currentPrice, order.sl, order.tp, undefined, order.ocoGroupId);
          audioAlertService.playOrderExecuted();
          webhookService.dispatchOrderFill(order, currentPrice);

          // If part of OCO group, mark group to cancel other orders
          if (order.ocoGroupId) {
            triggeredOcoGroupIds.add(order.ocoGroupId);
          }
        }
      } else {
        remainingOrders.push(order);
      }
    }

    // Filter out cancelled OCO siblings
    v.orders = remainingOrders.filter((o) => !(o.ocoGroupId && triggeredOcoGroupIds.has(o.ocoGroupId) && o.status === 'pending'));

    // 2. Evaluate Active Positions (P&L, SL, TP, and Trailing Stops)
    let totalUnrealizedPnl = 0;
    let totalMarginUsed = 0;
    const remainingPositions: PaperPosition[] = [];

    for (const pos of v.positions) {
      if (pos.symbol === symbol) {
        const delta = (currentPrice - pos.entryPrice) * (pos.side === 'buy' ? 1 : -1);
        const pnl = delta * pos.lots * OUNCES_PER_LOT;
        const pnlPercent = (delta / pos.entryPrice) * 100 * v.leverage;

        pos.currentPrice = currentPrice;
        pos.unrealizedPnl = Number(pnl.toFixed(2));
        pos.unrealizedPnlPercent = Number(pnlPercent.toFixed(2));

        // Evaluate Trailing Stop
        if (pos.trailingStopDistance && pos.trailingStopDistance > 0) {
          pos.highWaterMark = pos.highWaterMark ?? pos.entryPrice;

          if (pos.side === 'buy') {
            if (currentPrice > pos.highWaterMark) {
              pos.highWaterMark = currentPrice;
              const newSl = +(currentPrice - pos.trailingStopDistance).toFixed(2);
              if (!pos.sl || newSl > pos.sl) {
                pos.sl = newSl;
                stateChanged = true;
              }
            }
          } else {
            if (currentPrice < pos.highWaterMark) {
              pos.highWaterMark = currentPrice;
              const newSl = +(currentPrice + pos.trailingStopDistance).toFixed(2);
              if (!pos.sl || newSl < pos.sl) {
                pos.sl = newSl;
                stateChanged = true;
              }
            }
          }
        }

        // Check Stop-Loss & Trailing Stop triggers
        let closedReason: PaperTradeJournalEntry['reason'] | null = null;
        if (pos.sl && pos.sl > 0) {
          if (pos.side === 'buy' && currentPrice <= pos.sl) {
            closedReason = pos.trailingStopDistance ? 'trailing_sl' : 'sl';
          } else if (pos.side === 'sell' && currentPrice >= pos.sl) {
            closedReason = pos.trailingStopDistance ? 'trailing_sl' : 'sl';
          }
        }

        // Check Take-Profit
        if (!closedReason && pos.tp && pos.tp > 0) {
          if (pos.side === 'buy' && currentPrice >= pos.tp) closedReason = 'tp';
          else if (pos.side === 'sell' && currentPrice <= pos.tp) closedReason = 'tp';
        }

        if (closedReason) {
          this.closePositionInternal(pos, currentPrice, closedReason);
          audioAlertService.playBloombergChime();
          webhookService.dispatchSlTpHit(pos, currentPrice, closedReason as any, pos.unrealizedPnl);
          stateChanged = true;
          continue;
        }
      }

      totalUnrealizedPnl += pos.unrealizedPnl;
      totalMarginUsed += pos.marginUsed;
      remainingPositions.push(pos);
    }
    v.positions = remainingPositions;

    // 3. Update Account Metrics & Hard Risk Guardrails
    const equity = v.balance + totalUnrealizedPnl;
    const freeMargin = equity - totalMarginUsed;
    const marginLevel = totalMarginUsed > 0 ? (equity / totalMarginUsed) * 100 : 0;

    v.equity = Number(equity.toFixed(2));
    v.marginUsed = Number(totalMarginUsed.toFixed(2));
    v.freeMargin = Number(freeMargin.toFixed(2));
    v.marginLevel = Number(marginLevel.toFixed(1));

    // Daily Drawdown Circuit Breaker Calculation
    const dailyLoss = v.dailyStartingEquity - equity;
    const dailyDrawdownPercent = v.dailyStartingEquity > 0 ? (dailyLoss / v.dailyStartingEquity) * 100 : 0;

    if (!v.isCircuitBreakerTripped && dailyDrawdownPercent >= v.maxDailyDrawdownPercent) {
      // TRIP CIRCUIT BREAKER: Emergency liquidation to protect capital
      v.isCircuitBreakerTripped = true;
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      v.circuitBreakerExpiry = expiry;

      // Close all active positions
      for (const p of [...v.positions]) {
        this.closePositionInternal(p, currentPrice, 'circuit_breaker');
      }
      v.positions = [];
      v.orders = []; // Cancel all pending orders

      audioAlertService.playPriceAlert();
      webhookService.dispatchCircuitBreaker(v.name, equity, dailyDrawdownPercent);
      stateChanged = true;
    }

    // Liquidation Check (Margin call liquidation at < 50% margin level)
    if (totalMarginUsed > 0 && marginLevel < 50 && v.positions.length > 0) {
      const worstPos = [...v.positions].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl)[0];
      if (worstPos) {
        this.closePositionInternal(worstPos, currentPrice, 'liquidation');
        audioAlertService.playPriceAlert();
        stateChanged = true;
      }
    }

    if (stateChanged) {
      this.notify();
    }
  }

  /**
   * Place Market Order (Instant Fill at current live price)
   */
  public placeMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    lots: number,
    sl?: number,
    tp?: number,
    trailingStopDistance?: number
  ): { success: boolean; message: string; positionId?: string } {
    const v = this.activeVault;
    if (v.isCircuitBreakerTripped) {
      return {
        success: false,
        message: `TRADING LOCKED: Daily Drawdown Circuit Breaker tripped (-${v.maxDailyDrawdownPercent}%). Trading suspended for 24h.`,
      };
    }

    const price = this.lastKnownPrice;
    if (!price || price <= 0) {
      return { success: false, message: 'Invalid market price stream' };
    }

    const marginReq = (lots * OUNCES_PER_LOT * price) / v.leverage;
    if (marginReq > v.freeMargin) {
      return {
        success: false,
        message: `Insufficient Free Margin! Required: $${marginReq.toFixed(2)}, Available: $${v.freeMargin.toFixed(2)}`,
      };
    }

    const pos = this.executeMarketOrderInternal(symbol, side, lots, price, sl, tp, trailingStopDistance);
    audioAlertService.playOrderExecuted();

    const orderObj: PaperOrder = {
      id: pos.id,
      symbol,
      type: 'market',
      side,
      lots,
      targetPrice: price,
      sl,
      tp,
      createdAt: new Date().toISOString(),
      status: 'filled',
    };

    fixProtocolEngine.recordNewOrderSingle(orderObj);
    fixProtocolEngine.recordExecutionReport(orderObj, price, '2');
    webhookService.dispatchOrderFill(orderObj, price);

    this.notify();

    return {
      success: true,
      message: `Executed MARKET ${side.toUpperCase()} ${lots} Lots @ $${price.toFixed(2)}`,
      positionId: pos.id,
    };
  }

  /**
   * Place Limit Order
   */
  public placeLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    lots: number,
    targetPrice: number,
    sl?: number,
    tp?: number
  ): { success: boolean; message: string; orderId?: string } {
    const v = this.activeVault;
    if (v.isCircuitBreakerTripped) {
      return { success: false, message: 'TRADING LOCKED: Circuit Breaker active.' };
    }

    const marginReq = (lots * OUNCES_PER_LOT * targetPrice) / v.leverage;
    if (marginReq > v.freeMargin) {
      return {
        success: false,
        message: `Insufficient Margin for Limit order! Required: $${marginReq.toFixed(2)}`,
      };
    }

    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
    const newOrder: PaperOrder = {
      id: `ord_${Date.now()}_${uid}`,
      symbol,
      type: 'limit',
      side,
      lots,
      targetPrice: Number(targetPrice.toFixed(2)),
      sl: sl && sl > 0 ? Number(sl.toFixed(2)) : undefined,
      tp: tp && tp > 0 ? Number(tp.toFixed(2)) : undefined,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    v.orders.unshift(newOrder);
    fixProtocolEngine.recordNewOrderSingle(newOrder);
    audioAlertService.playBloombergChime();
    this.notify();

    return {
      success: true,
      message: `Placed LIMIT ${side.toUpperCase()} ${lots} Lots @ $${targetPrice.toFixed(2)}`,
      orderId: newOrder.id,
    };
  }

  /**
   * Place OCO (One-Cancels-the-Other) Linked Order Pair
   */
  public placeOcoOrder(
    symbol: string,
    side: 'buy' | 'sell',
    lots: number,
    limitPrice: number,
    stopPrice: number,
    sl?: number,
    tp?: number
  ): { success: boolean; message: string } {
    const v = this.activeVault;
    if (v.isCircuitBreakerTripped) {
      return { success: false, message: 'TRADING LOCKED: Circuit Breaker active.' };
    }

    const ocoGroupId = `oco_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 6) : performance.now().toFixed(0)}`;
    const uid1 = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 6) : performance.now().toFixed(0);
    const uid2 = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 6) : performance.now().toFixed(0);

    const order1: PaperOrder = {
      id: `ord_oco1_${uid1}`,
      symbol,
      type: 'oco',
      side,
      lots,
      targetPrice: Number(limitPrice.toFixed(2)),
      sl,
      tp,
      ocoGroupId,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const order2: PaperOrder = {
      id: `ord_oco2_${uid2}`,
      symbol,
      type: 'stop',
      side,
      lots,
      targetPrice: Number(stopPrice.toFixed(2)),
      sl,
      tp,
      ocoGroupId,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    v.orders.unshift(order1, order2);
    audioAlertService.playBloombergChime();
    this.notify();

    return {
      success: true,
      message: `Placed OCO Linked Orders (Limit @ $${limitPrice.toFixed(2)} / Stop @ $${stopPrice.toFixed(2)})`,
    };
  }

  /**
   * Place Institutional Iceberg Order
   */
  public placeIcebergOrder(
    symbol: string,
    side: 'buy' | 'sell',
    totalLots: number,
    visibleLots: number,
    targetPrice: number,
    sl?: number,
    tp?: number
  ): { success: boolean; message: string; orderId?: string } {
    const v = this.activeVault;
    if (v.isCircuitBreakerTripped) {
      return { success: false, message: 'TRADING LOCKED: Circuit Breaker active.' };
    }

    const firstTrancheLots = Math.min(visibleLots, totalLots);
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);

    const icebergOrder: PaperOrder = {
      id: `ord_iceberg_${Date.now()}_${uid}`,
      symbol,
      type: 'iceberg',
      side,
      lots: firstTrancheLots,
      targetPrice: Number(targetPrice.toFixed(2)),
      sl: sl && sl > 0 ? Number(sl.toFixed(2)) : undefined,
      tp: tp && tp > 0 ? Number(tp.toFixed(2)) : undefined,
      totalLots,
      visibleLots,
      executedLots: 0,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    v.orders.unshift(icebergOrder);
    audioAlertService.playBloombergChime();
    this.notify();

    return {
      success: true,
      message: `Placed ICEBERG Order: Total ${totalLots} Lots (Showing ${firstTrancheLots} Lots) @ $${targetPrice.toFixed(2)}`,
      orderId: icebergOrder.id,
    };
  }

  private executeMarketOrderInternal(
    symbol: string,
    side: 'buy' | 'sell',
    lots: number,
    price: number,
    sl?: number,
    tp?: number,
    trailingStopDistance?: number,
    ocoGroupId?: string
  ): PaperPosition {
    const v = this.activeVault;
    const marginUsed = (lots * OUNCES_PER_LOT * price) / v.leverage;
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);

    let initialSl = sl && sl > 0 ? Number(sl.toFixed(2)) : undefined;
    if (trailingStopDistance && trailingStopDistance > 0 && !initialSl) {
      initialSl = side === 'buy' ? +(price - trailingStopDistance).toFixed(2) : +(price + trailingStopDistance).toFixed(2);
    }

    const newPos: PaperPosition = {
      id: `pos_${Date.now()}_${uid}`,
      symbol,
      side,
      lots,
      entryPrice: price,
      currentPrice: price,
      sl: initialSl,
      tp: tp && tp > 0 ? Number(tp.toFixed(2)) : undefined,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      marginUsed: Number(marginUsed.toFixed(2)),
      openTime: new Date().toISOString(),
      trailingStopDistance,
      highWaterMark: price,
      ocoGroupId,
    };

    v.positions.push(newPos);
    v.marginUsed += marginUsed;
    v.freeMargin = v.equity - v.marginUsed;

    return newPos;
  }

  /**
   * Close a specific position at market
   */
  public closePosition(positionId: string): boolean {
    const v = this.activeVault;
    const idx = v.positions.findIndex((p) => p.id === positionId);
    if (idx === -1) return false;

    const pos = v.positions[idx];
    const currentPrice = this.lastKnownPrice;

    this.closePositionInternal(pos, currentPrice, 'manual');
    v.positions.splice(idx, 1);

    audioAlertService.playOrderExecuted();
    webhookService.dispatchSlTpHit(pos, currentPrice, 'sl', pos.unrealizedPnl);
    this.notify();
    return true;
  }

  /**
   * Close ALL open positions
   */
  public closeAllPositions(): number {
    const v = this.activeVault;
    const count = v.positions.length;
    if (count === 0) return 0;

    const currentPrice = this.lastKnownPrice;
    for (const pos of v.positions) {
      this.closePositionInternal(pos, currentPrice, 'manual');
    }
    v.positions = [];
    audioAlertService.playPriceAlert();
    this.notify();
    return count;
  }

  /**
   * Cancel a pending order
   */
  public cancelOrder(orderId: string): boolean {
    const v = this.activeVault;
    const idx = v.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;

    const order = v.orders[idx];
    order.status = 'cancelled';
    v.orders.splice(idx, 1);

    // If order is part of OCO, also cancel its sibling
    if (order.ocoGroupId) {
      const siblingIdx = v.orders.findIndex((o) => o.ocoGroupId === order.ocoGroupId && o.status === 'pending');
      if (siblingIdx !== -1) {
        v.orders[siblingIdx].status = 'cancelled';
        v.orders.splice(siblingIdx, 1);
      }
    }

    this.notify();
    return true;
  }

  private closePositionInternal(
    pos: PaperPosition,
    exitPrice: number,
    reason: PaperTradeJournalEntry['reason']
  ) {
    const v = this.activeVault;
    const delta = (exitPrice - pos.entryPrice) * (pos.side === 'buy' ? 1 : -1);
    const realizedPnl = Number((delta * pos.lots * OUNCES_PER_LOT).toFixed(2));

    v.balance = Number((v.balance + realizedPnl).toFixed(2));

    const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : performance.now().toFixed(0);
    const entry: PaperTradeJournalEntry = {
      id: `trade_${Date.now()}_${uid}`,
      symbol: pos.symbol,
      side: pos.side,
      lots: pos.lots,
      entryPrice: pos.entryPrice,
      exitPrice: Number(exitPrice.toFixed(2)),
      realizedPnl,
      openTime: pos.openTime,
      closeTime: new Date().toISOString(),
      reason,
    };

    v.history.unshift(entry);
    this.recalculateHistoryMetrics();
  }

  private recalculateHistoryMetrics() {
    const v = this.activeVault;
    const total = v.history.length;
    v.totalTrades = total;
    if (total === 0) {
      v.winRate = 0;
      v.profitFactor = 0;
      return;
    }

    const wins = v.history.filter((h) => h.realizedPnl > 0);
    const losses = v.history.filter((h) => h.realizedPnl < 0);

    const grossProfit = wins.reduce((sum, h) => sum + h.realizedPnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, h) => sum + h.realizedPnl, 0));

    v.winRate = Number(((wins.length / total) * 100).toFixed(1));
    v.profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;
  }

  /**
   * Reset active paper account to initial balance
   */
  public resetAccount() {
    const v = this.activeVault;
    v.positions = [];
    v.orders = [];
    v.history = [];
    v.balance = v.initialBalance;
    v.equity = v.initialBalance;
    v.marginUsed = 0;
    v.freeMargin = v.initialBalance;
    v.marginLevel = 0;
    v.winRate = 0;
    v.totalTrades = 0;
    v.profitFactor = 0;
    v.dailyStartingEquity = v.initialBalance;
    v.isCircuitBreakerTripped = false;
    v.circuitBreakerExpiry = null;

    audioAlertService.playBloombergChime();
    this.notify();
  }
}

export const paperTradingEngine = new PaperTradingEngine();
