export type Exchange = 'binance-futures' | 'bybit-linear' | 'deribit';

export type FeedState =
  | 'CONNECTING' | 'LIVE' | 'DELAYED' | 'STALE'
  | 'RECONNECTING' | 'DISCONNECTED' | 'UNSUPPORTED' | 'ERROR';

export type MarketRegime = 'range' | 'unclear' | 'trend' | 'volatile';

export type TradeSide = 'buy' | 'sell';

export interface NormalizedTrade {
  exchange: Exchange;
  symbol: string;
  tradeId: string;
  price: number;
  qty: number;
  quoteQty: number;
  side: TradeSide;
  timestamp: number;
}

export interface NormalizedLiquidation {
  exchange: Exchange;
  symbol: string;
  t: number;
  price: number;
  usd: number;
  long: boolean;
}

export interface BookLevel { price: number; qty: number; }

export interface NormalizedDepth {
  exchange: Exchange;
  symbol: string;
  bids: BookLevel[];
  asks: BookLevel[];
  timestamp: number;
}

export interface NormalizedMarkPrice {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  timestamp: number;
}

export interface HeatmapCell { price: number; size: number; }
export interface HeatmapColumn {
  t: number;
  dom: HeatmapCell[];
}

export interface FootprintCell { row: number; sellVol: number; buyVol: number; }
export interface FootprintCandle {
  t: number;
  cells: FootprintCell[];
}

export type DecisionSignalName =
  | 'aggression60' | 'aggression10' | 'cvdTrend' | 'book' | 'absorption'
  | 'stacked' | 'value' | 'largePrints' | 'liquidity';

export interface DecisionSignal {
  name: DecisionSignalName;
  weight: number;
  value: number;
}

export interface DecisionSnapshot {
  score: number;
  rawScore: number;
  regime: MarketRegime;
  direction: 'BUY' | 'SELL' | 'LEAN_BUY' | 'LEAN_SELL' | 'NEUTRAL';
  confidence: number;
  signals: DecisionSignal[];
  gates: { strength: boolean; activity: boolean; flow: boolean; targetCost: boolean; rr: boolean; trend: boolean };
  sampleCount: number;
}

export type DangerLevel = 'CALM' | 'ELEVATED' | 'HIGH';
export interface DangerSnapshot { level: DangerLevel; inputs: Record<string, number>; }

export interface FuturesContext {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  openInterestUsd: number;
  timestamp: number;
}

export interface NormalizedOption {
  instrumentName: string;
  strike: number;
  optionType: 'call' | 'put';
  expiry: number;
  markIv: number;
  openInterest: number;
  underlyingPrice: number;
}
