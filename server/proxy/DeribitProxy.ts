/**
 * DeribitProxy — polls Deribit's public option book summary and derives a
 * GEX (gamma exposure) profile, then serves it over REST and SSE.
 *
 * Deribit exposes no usable public WS options feed for this use case, so the
 * proxy polls REST every POLL_MS and caches the computed profile.
 * Gamma math is reused from src/lib/orderflow/gexCalculator.ts.
 *
 * NOTE: the live API no longer returns strike / option_type /
 * expiration_timestamp. Those are encoded in instrument_name
 * ("BTC-26MAR27-40000-C"), so every entry is normalized from the instrument
 * name and the explicit fields are only used when present.
 */
import type { ServerResponse } from 'http';
import type { FeedState, NormalizedOption } from '../../src/types/orderFlow';
import { computeGexProfile } from '../../src/lib/orderflow/gexCalculator';

const DERIBIT_BASE = 'https://www.deribit.com/api/v2/public/get_book_summary_by_currency';
const POLL_MS = 5000;
const IDLE_DISCONNECT_MS = 30000;

export interface DeribitBookSummary {
  instrument_name: string;
  kind?: string;
  strike?: number;
  option_type?: string;
  expiration_timestamp?: number;
  mark_iv?: number;
  open_interest?: number;
  underlying_price?: number;
}

export interface DeribitResponse {
  result?: DeribitBookSummary[];
  error?: { code?: number; message?: string };
}

export interface GexProfilePayload {
  symbol: string;
  currency: string;
  spot: number;
  flipStrike: number | null;
  callWall: number;
  putWall: number;
  maxPain: number | null;
  gammaProfile: { strike: number; callGamma: number; putGamma: number; netGamma: number }[];
  optionCount: number;
  timestamp: number;
}

export type SSEClient = {
  id: string;
  res: ServerResponse;
};

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Deribit expiries settle at 08:00 UTC. */
const EXPIRY_HOUR_UTC = 8;

export function parseDeribitExpiry(token: string): number | null {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(token);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]];
  const year = 2000 + Number(m[3]);
  if (month === undefined || !Number.isFinite(day)) return null;
  const ts = Date.UTC(year, month, day, EXPIRY_HOUR_UTC, 0, 0);
  return Number.isFinite(ts) ? ts : null;
}

/** Parse "BTC-26MAR27-40000-C" into strike / type / expiry. */
export function parseDeribitInstrument(name: string): {
  strike: number;
  optionType: 'call' | 'put';
  expiry: number;
} | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const strike = Number(parts[2]);
  const expiry = parseDeribitExpiry(parts[1]);
  if (!Number.isFinite(strike) || expiry === null) return null;
  const flag = parts[3].toUpperCase();
  if (flag === 'C') return { strike, optionType: 'call', expiry };
  if (flag === 'P') return { strike, optionType: 'put', expiry };
  return null;
}

function toNumOr(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function normalizeEntry(raw: DeribitBookSummary): NormalizedOption | null {
  const name = raw.instrument_name;
  if (typeof name !== 'string' || name.length === 0) return null;
  const parsed = parseDeribitInstrument(name);

  const optionType: 'call' | 'put' | null =
    raw.option_type === 'call' || raw.option_type === 'put'
      ? raw.option_type
      : parsed?.optionType ?? null;
  const strike =
    typeof raw.strike === 'number' && Number.isFinite(raw.strike) ? raw.strike : parsed?.strike ?? null;
  const expiry =
    typeof raw.expiration_timestamp === 'number' && Number.isFinite(raw.expiration_timestamp)
      ? raw.expiration_timestamp
      : parsed?.expiry ?? null;

  if (!optionType || strike === null || expiry === null) return null;

  return {
    instrumentName: name,
    strike,
    optionType,
    expiry,
    markIv: toNumOr(raw.mark_iv, 0),
    openInterest: toNumOr(raw.open_interest, 0),
    underlyingPrice: toNumOr(raw.underlying_price, 0),
  };
}

/** Map a requested symbol (BTC, BTCUSDT, BTC-USD, BTCUSDT.PERP) to a Deribit currency. */
export function toDeribitCurrency(symbol: string): string {
  const upper = (symbol || 'BTC').toUpperCase();
  const base = upper.split(/[-_/]/)[0].replace(/USDT$|USDC$|USD$|PERP$/g, '');
  return base.length >= 2 ? base : 'BTC';
}

export function toDeribitKind(kind: string): string {
  const k = (kind || 'option').toLowerCase();
  return k === 'future' || k === 'futures' ? 'future' : 'option';
}

export async function fetchDeribitOptions(
  currency: string,
  kind: string = 'option'
): Promise<NormalizedOption[]> {
  const url = `${DERIBIT_BASE}?currency=${encodeURIComponent(currency)}&kind=${encodeURIComponent(kind)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Deribit ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as DeribitResponse;
  if (data.error) {
    throw new Error(`Deribit error ${data.error.code ?? ''} ${data.error.message ?? ''}`.trim());
  }
  const rows = Array.isArray(data.result) ? data.result : [];
  const options: NormalizedOption[] = [];
  for (const row of rows) {
    const normalized = normalizeEntry(row);
    if (normalized) options.push(normalized);
  }
  if (options.length === 0) {
    throw new Error(`Deribit returned no ${kind} entries for ${currency}`);
  }
  return options;
}

export class DeribitProxy {
  private currency: string;
  private kind: string;
  private status: FeedState = 'CONNECTING';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private options: NormalizedOption[] = [];
  private profile: GexProfilePayload | null = null;
  private lastError: string | null = null;
  private polling = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(symbol: string = 'BTC', kind: string = 'option') {
    this.currency = toDeribitCurrency(symbol);
    this.kind = toDeribitKind(kind);
  }

  public getCurrency(): string {
    return this.currency;
  }

  public getStatus(): FeedState {
    return this.status;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getOptions(): NormalizedOption[] {
    return this.options;
  }

  public getProfile(): GexProfilePayload | null {
    return this.profile;
  }

  public start(): void {
    if (this.pollTimer !== null) return;
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_MS);
  }

  public stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public addClient(id: string, res: ServerResponse): void {
    this.clients.set(id, { id, res });
    this.resetIdleTimer();
    if (this.profile) {
      this.send(res, { type: 'gamma', gamma: this.profile });
    } else {
      this.send(res, { type: 'status', status: this.status, currency: this.currency });
    }
  }

  public removeClient(id: string): void {
    this.clients.delete(id);
    if (this.clients.size === 0) this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.clients.size === 0 && this.pollTimer !== null) {
      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        if (this.clients.size === 0) {
          this.stop();
          this.status = 'DISCONNECTED';
        }
      }, IDLE_DISCONNECT_MS);
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const options = await fetchDeribitOptions(this.currency, this.kind);
      const spot = this.deriveSpot(options);
      if (spot > 0) {
        this.options = options;
        const gex = computeGexProfile(options, spot);
        this.profile = {
          symbol: this.currency,
          currency: this.currency,
          spot,
          flipStrike: gex.flipLevel,
          callWall: gex.callWall,
          putWall: gex.putWall,
          maxPain: gex.maxPain,
          gammaProfile: gex.prices.map((p, i) => ({
            strike: p,
            callGamma: Math.max(0, gex.netGex[i]),
            putGamma: Math.min(0, gex.netGex[i]),
            netGamma: gex.netGex[i],
          })),
          optionCount: options.length,
          timestamp: Date.now(),
        };
        this.lastError = null;
        if (this.status !== 'LIVE') this.status = 'LIVE';
        this.broadcast({ type: 'gamma', gamma: this.profile });
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      if (this.status === 'CONNECTING' || this.status === 'LIVE') this.status = 'DELAYED';
    } finally {
      this.polling = false;
    }
  }

  private deriveSpot(options: NormalizedOption[]): number {
    let sum = 0;
    let n = 0;
    for (const o of options) {
      if (Number.isFinite(o.underlyingPrice) && o.underlyingPrice > 0) {
        sum += o.underlyingPrice;
        n++;
      }
    }
    return n > 0 ? sum / n : 0;
  }

  private send(res: ServerResponse, payload: unknown): void {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      /* client socket already gone */
    }
  }

  private broadcast(payload: unknown): void {
    if (this.clients.size === 0) return;
    const frame = `data: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients) {
      try {
        client.res.write(frame);
      } catch {
        this.clients.delete(id);
      }
    }
  }
}

export default DeribitProxy;