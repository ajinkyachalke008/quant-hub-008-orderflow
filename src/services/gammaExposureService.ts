// gammaExposureService.ts — Deribit options -> GEX profile service. No React imports.
import { computeGexProfile } from '../lib/orderflow/gexCalculator';
import { GEXProfile } from '../stores/orderFlowStore';
import { NormalizedOption } from '../types/orderFlow';

const DERIBIT_URL =
  'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option';

/** Deribit expiries settle at 08:00 UTC. */
const EXPIRY_HOUR_UTC = 8;

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Parse "26MAR27" into a UTC timestamp (settles 08:00 UTC). */
function parseDeribitExpiry(token: string): number | null {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(token);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]];
  const year = 2000 + Number(m[3]);
  if (month === undefined || !Number.isFinite(day)) return null;
  const ts = Date.UTC(year, month, day, EXPIRY_HOUR_UTC, 0, 0);
  return Number.isFinite(ts) ? ts : null;
}

/** Parse "BTC-26MAR27-40000-C" into strike / optionType / expiry. */
function parseDeribitInstrument(name: string): {
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

interface DeribitBookSummaryRaw {
  instrument_name?: string;
  strike?: number;
  option_type?: 'call' | 'put';
  expiration_timestamp?: number;
  mark_iv?: number;
  open_interest?: number;
  underlying_price?: number;
}

/** Normalize one book-summary entry, tolerating both old and new API shapes. */
function normalizeEntry(raw: DeribitBookSummaryRaw): NormalizedOption | null {
  const name = raw.instrument_name;
  if (typeof name !== 'string' || name.length === 0) return null;
  const parsed = parseDeribitInstrument(name);

  const optionType: 'call' | 'put' | null =
    raw.option_type === 'call' || raw.option_type === 'put'
      ? raw.option_type
      : parsed?.optionType ?? null;
  const strike =
    typeof raw.strike === 'number' && Number.isFinite(raw.strike)
      ? raw.strike
      : parsed?.strike ?? null;
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

export class GammaExposureService {
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetchOptions(): Promise<NormalizedOption[]> {
    try {
      const res = await fetch(DERIBIT_URL);
      if (!res.ok) {
        console.error('[GammaExposureService] deribit fetch failed:', res.status, res.statusText);
        return [];
      }
      const data = await res.json();
      const rows = Array.isArray(data?.result) ? (data.result as DeribitBookSummaryRaw[]) : [];
      return rows
        .map((o) => normalizeEntry(o as DeribitBookSummaryRaw))
        .filter((o): o is NormalizedOption => o !== null);
    } catch (err) {
      console.error('[GammaExposureService] fetchOptions error', err);
      return [];
    }
  }

  computeProfile(options: NormalizedOption[], spot: number): GEXProfile {
    try {
      const gex = computeGexProfile(options, spot);
      return {
        spot,
        flipStrike: gex.flipLevel,
        gammaProfile: gex.prices.map((p, i) => ({
          strike: p,
          callGamma: Math.max(0, gex.netGex[i]),
          putGamma: Math.min(0, gex.netGex[i]),
          netGamma: gex.netGex[i],
        })),
        timestamp: Date.now(),
      };
    } catch (err) {
      console.error('[GammaExposureService] computeProfile error', err);
      return { spot, flipStrike: null, gammaProfile: [], timestamp: Date.now() };
    }
  }

  start(spot: number, onProfile: (p: GEXProfile) => void): void {
    this.stop();
    const tick = async () => {
      const options = await this.fetchOptions();
      onProfile(this.computeProfile(options, spot));
    };
    void tick();
    this.timer = setInterval(tick, 5000);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

