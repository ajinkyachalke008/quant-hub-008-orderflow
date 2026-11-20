// gammaExposureService.ts — Deribit options -> GEX profile service. No React imports.
import { computeGexProfile } from '../lib/orderflow/gexCalculator';
import { GEXProfile } from '../stores/orderFlowStore';
import { NormalizedOption } from '../types/orderFlow';

interface DeribitBookSummary {
  instrument_name: string;
  strike: number;
  option_type: 'call' | 'put';
  expiration_timestamp: number;
  mark_iv: number;
  open_interest: number;
  underlying_price: number;
}

interface DeribitResponse {
  result: DeribitBookSummary[];
}

const DERIBIT_URL =
  'https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option';

export class GammaExposureService {
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetchOptions(): Promise<NormalizedOption[]> {
    try {
      const res = await fetch(DERIBIT_URL);
      if (!res.ok) {
        console.error('[GammaExposureService] deribit fetch failed:', res.status, res.statusText);
        return [];
      }
      const data: DeribitResponse = await res.json();
      return (data.result ?? []).map((o) => ({
        instrumentName: o.instrument_name,
        strike: o.strike,
        optionType: o.option_type,
        expiry: o.expiration_timestamp,
        markIv: o.mark_iv,
        openInterest: o.open_interest,
        underlyingPrice: o.underlying_price,
      }));
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
