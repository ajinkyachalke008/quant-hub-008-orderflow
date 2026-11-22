import { create, StoreApi, UseBoundStore } from 'zustand';
import {
  Exchange,
  FeedState,
  NormalizedTrade,
  NormalizedLiquidation,
  NormalizedDepth,
  NormalizedMarkPrice,
  NormalizedOption,
  HeatmapColumn,
  DecisionSnapshot,
  DangerSnapshot,
  FuturesContext,
  MarketRegime,
} from '../types/orderFlow';

export interface GEXProfile {
  spot: number;
  flipStrike: number | null;
  gammaProfile: { strike: number; callGamma: number; putGamma: number; netGamma: number }[];
  options: NormalizedOption[];
  timestamp: number;
}

export interface OrderFlowState {
  symbol: string;
  exchange: Exchange;
  feedStates: Record<string, FeedState>;
  trades: NormalizedTrade[];
  liquidations: NormalizedLiquidation[];
  depth: NormalizedDepth | null;
  markPrice: NormalizedMarkPrice | null;
  decision: DecisionSnapshot | null;
  danger: DangerSnapshot | null;
  futuresContext: FuturesContext | null;
  gexProfile: GEXProfile | null;
  heatmapColumns: HeatmapColumn[];
  tradeIdSeen: Set<string>;
  setSymbol: (symbol: string) => void;
  setExchange: (exchange: Exchange) => void;
  addTrade: (trade: NormalizedTrade) => void;
  addLiquidation: (liq: NormalizedLiquidation) => void;
  setDepth: (depth: NormalizedDepth) => void;
  setMarkPrice: (m: NormalizedMarkPrice) => void;
  setDecision: (d: DecisionSnapshot) => void;
  setDanger: (d: DangerSnapshot) => void;
  setFuturesContext: (f: FuturesContext) => void;
  setGEXProfile: (g: GEXProfile | null) => void;
  setHeatmapColumns: (cols: HeatmapColumn[]) => void;
  addHeatmapColumn: (col: HeatmapColumn) => void;
  setFeedState: (feed: string, state: FeedState) => void;
  resetOrderFlowBuffers: (symbol: string) => void;
}

const TRADES_MAX = 500;
const LIQUIDATIONS_MAX = 10000;
const HEATMAP_MAX = 1440;
const DEDUPE_MAX = 1000;
const WHALE_THRESHOLD = 5000;

function clearBuffersState(state: OrderFlowState, symbol: string): Partial<OrderFlowState> {
  return {
    symbol,
    trades: [],
    liquidations: [],
    depth: null,
    heatmapColumns: [],
    decision: null,
    danger: null,
    tradeIdSeen: new Set<string>(),
    feedStates: Object.fromEntries(Object.keys(state.feedStates).map((feed) => [feed, 'CONNECTING'])),
  };
}

export const useOrderFlowStore: UseBoundStore<StoreApi<OrderFlowState>> = create<OrderFlowState>((set, get) => ({
  symbol: 'BTCUSDT',
  exchange: 'binance-futures',
  feedStates: {},
  trades: [],
  liquidations: [],
  depth: null,
  markPrice: null,
  decision: null,
  danger: null,
  futuresContext: null,
  gexProfile: null,
  heatmapColumns: [],
  tradeIdSeen: new Set(),

  setSymbol: (symbol) => {
    set((state) => clearBuffersState(state, symbol), false);
  },

  setExchange: (exchange) => {
    set({ exchange }, false);
  },

  addTrade: (trade) => {
    const state = get();
    if (state.tradeIdSeen.has(trade.tradeId)) return;
    const nextSeen = new Set<string>(state.tradeIdSeen);
    nextSeen.add(trade.tradeId);
    if (nextSeen.size > DEDUPE_MAX) {
      const toRemove = [...nextSeen.keys()].slice(0, nextSeen.size - DEDUPE_MAX);
      for (const id of toRemove) nextSeen.delete(id);
    }
    const next = [trade, ...state.trades].slice(0, TRADES_MAX);
    set({ trades: next, tradeIdSeen: nextSeen }, false);
  },

  addLiquidation: (liq) => {
    const next = [liq, ...get().liquidations].slice(0, LIQUIDATIONS_MAX);
    set({ liquidations: next }, false);
  },

  setDepth: (depth) => {
    set({ depth }, false);
  },

  setMarkPrice: (m) => {
    set({ markPrice: m }, false);
  },

  setDecision: (d) => {
    set({ decision: d }, false);
  },

  setDanger: (d) => {
    set({ danger: d }, false);
  },

  setFuturesContext: (f) => {
    set({ futuresContext: f }, false);
  },

  setGEXProfile: (g) => {
    set({ gexProfile: g }, false);
  },

  setHeatmapColumns: (cols) => {
    set({ heatmapColumns: cols.slice(0, HEATMAP_MAX) }, false);
  },

  addHeatmapColumn: (col) => {
    const next = [...get().heatmapColumns, col].slice(0, HEATMAP_MAX);
    set({ heatmapColumns: next }, false);
  },

  setFeedState: (feed, state) => {
    set((prev) => ({ feedStates: { ...prev.feedStates, [feed]: state } }), false);
  },

  resetOrderFlowBuffers: (symbol) => {
    set((state) => clearBuffersState(state, symbol), false);
  },
}));

export function resetOrderFlowBuffers(store: UseBoundStore<StoreApi<OrderFlowState>>, symbol: string): void {
  store.setState((state) => clearBuffersState(state, symbol), false);
}

export const selectWhales = (state: OrderFlowState) =>
  state.trades.filter((t) => t.quoteQty >= WHALE_THRESHOLD);

export const selectTradeCount = (state: OrderFlowState) => state.trades.length;

export const selectLiquidationCount = (state: OrderFlowState) => state.liquidations.length;

export type OrderFlowStore = OrderFlowState;
