/**
 * server/proxy — server-side market data proxies (R08 live WS delivery).
 *
 * Exposes the three exchange proxies plus a ProxyManager that owns their
 * lifecycle: one upstream connection per (exchange, symbol), fanned out to
 * N SSE clients, torn down once the last client leaves.
 */
import type { ServerResponse } from 'http';
import type { FeedState } from '../../src/types/orderFlow';
import { BinanceFuturesProxy } from './BinanceFuturesProxy';
import { BybitLinearProxy } from './BybitLinearProxy';
import { DeribitProxy } from './DeribitProxy';

export { BinanceFuturesProxy } from './BinanceFuturesProxy';
export { BybitLinearProxy, BybitOrderBookState } from './BybitLinearProxy';
export {
  DeribitProxy,
  fetchDeribitOptions,
  toDeribitCurrency,
  toDeribitKind,
} from './DeribitProxy';
export type {
  DeribitBookSummary,
  DeribitResponse,
  GexProfilePayload,
} from './DeribitProxy';

export type ExchangeKind = 'binance' | 'bybit' | 'deribit';

type AnyProxy = BinanceFuturesProxy | BybitLinearProxy | DeribitProxy;

interface ManagedEntry {
  key: string;
  kind: ExchangeKind;
  symbol: string;
  proxy: AnyProxy;
  dispose: () => void;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const IDLE_DISCONNECT_MS = 30000;

function assertNever(kind: string): never {
  throw new Error(`Unknown proxy kind: ${kind}`);
}

export class ProxyManager {
  private entries: Map<string, ManagedEntry> = new Map();

  public static key(kind: ExchangeKind, symbol: string): string {
    return `${kind}:${(symbol || '').toUpperCase()}`;
  }

  /** Attach an SSE client to a (possibly new) proxy and return its status. */
  public attach(
    kind: ExchangeKind,
    symbol: string,
    clientId: string,
    res: ServerResponse
  ): FeedState {
    const key = ProxyManager.key(kind, symbol);
    let entry = this.entries.get(key);
    if (entry && entry.proxy.getStatus() === 'DISCONNECTED') {
      // Its own idle timer already tore the upstream down; rebuild it.
      if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
      try {
        entry.dispose();
      } catch {
        /* ignore */
      }
      this.entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      entry = this.create(kind, symbol, key);
      this.entries.set(key, entry);
    }
    if (entry.idleTimer !== null) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
    entry.proxy.addClient(clientId, res);
    return entry.proxy.getStatus();
  }

  public detach(kind: ExchangeKind, symbol: string, clientId: string): void {
    const key = ProxyManager.key(kind, symbol);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.proxy.removeClient(clientId);
    if (entry.proxy.getClientCount() === 0) this.scheduleDispose(entry);
  }

  public getStatusSnapshot(): Array<{
    key: string;
    kind: ExchangeKind;
    symbol: string;
    status: FeedState;
    clients: number;
  }> {
    return Array.from(this.entries.values()).map((e) => ({
      key: e.key,
      kind: e.kind,
      symbol: e.symbol,
      status: e.proxy.getStatus(),
      clients: e.proxy.getClientCount(),
    }));
  }

  /** Tear down every proxy and clear timers. Safe to call on shutdown. */
  public shutdown(): void {
    for (const entry of this.entries.values()) {
      if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
      try {
        entry.dispose();
      } catch {
        /* ignore */
      }
    }
    this.entries.clear();
  }

  private create(kind: ExchangeKind, symbol: string, key: string): ManagedEntry {
    if (kind === 'binance') {
      const proxy = new BinanceFuturesProxy(symbol);
      proxy.connect();
      return { key, kind, symbol: symbol.toUpperCase(), proxy, dispose: () => proxy.disconnect(), idleTimer: null };
    }
    if (kind === 'bybit') {
      const proxy = new BybitLinearProxy(symbol);
      proxy.connect();
      return { key, kind, symbol: symbol.toUpperCase(), proxy, dispose: () => proxy.disconnect(), idleTimer: null };
    }
    if (kind === 'deribit') {
      const proxy = new DeribitProxy(symbol);
      proxy.start();
      return { key, kind, symbol: symbol.toUpperCase(), proxy, dispose: () => proxy.stop(), idleTimer: null };
    }
    return assertNever(kind);
  }

  private scheduleDispose(entry: ManagedEntry): void {
    if (entry.idleTimer !== null) return;
    entry.idleTimer = setTimeout(() => {
      entry.idleTimer = null;
      if (entry.proxy.getClientCount() > 0) return;
      try {
        entry.dispose();
      } catch {
        /* ignore */
      }
      this.entries.delete(entry.key);
    }, IDLE_DISCONNECT_MS);
    // Never hold the process open just for a pending teardown.
    if (typeof entry.idleTimer === 'object' && 'unref' in entry.idleTimer) {
      (entry.idleTimer as { unref: () => void }).unref();
    }
  }
}

export const proxyManager = new ProxyManager();

export default ProxyManager;