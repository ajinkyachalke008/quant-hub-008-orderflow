export type AssetType = 'equity' | 'crypto' | 'macro' | 'forex' | 'index' | 'commodity';

export interface TickerQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: string;
  marketCap: string;
  peRatio?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  beta?: number;
  eps?: number;
  divYield?: string;
  assetType: AssetType;
  sparkline: number[];
  confidence?: number;
  bid?: number;
  ask?: number;
  spread?: number;
}

export interface Candle {
  time: string;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;
  upperBand?: number;
  lowerBand?: number;
  middleBand?: number;
  vwap?: number;
  sar?: number;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  stochRsi?: {
    k: number;
    d: number;
  };
  atr?: number;
  // Module 3: Advanced Technical Indicators
  tenkan?: number;
  kijun?: number;
  senkouA?: number;
  senkouB?: number;
  chikou?: number;
  vwapSd1Upper?: number;
  vwapSd1Lower?: number;
  vwapSd2Upper?: number;
  vwapSd2Lower?: number;
  vwapSd3Upper?: number;
  vwapSd3Lower?: number;
  donchianUpper?: number;
  donchianLower?: number;
  donchianMiddle?: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M' | 'ALL';

export type ChartStyle = 'candle' | 'bar' | 'line' | 'area';

export type OverlayIndicator =
  | 'sma20'
  | 'sma50'
  | 'sma200'
  | 'ema9'
  | 'ema21'
  | 'ema50'
  | 'ema200'
  | 'bb'
  | 'vwap'
  | 'sar'
  | 'volume'
  | 'ichimoku'
  | 'vwap_bands'
  | 'donchian';

export type SubPaneIndicator = 'rsi' | 'macd' | 'stoch' | 'atr' | 'pine';

export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
  type: 'retracement' | 'extension';
}

export type PivotType = 'classic' | 'fibonacci' | 'camarilla' | 'off';

export interface PivotPoints {
  type: PivotType;
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface BullionSession {
  name: string;
  city: string;
  openUtc: number; // Hour in UTC
  closeUtc: number;
  isOpen: boolean;
  isOverlap?: boolean;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface TradeTick {
  id: string;
  price: number;
  amount: number;
  time: string;
  side: 'buy' | 'sell';
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  symbols: string[];
  snippet: string;
}

export interface MacroIndicator {
  id: string;
  name: string;
  value: string;
  change: string;
  deltaType: 'up' | 'down' | 'neutral';
  category: 'Rates & Yields' | 'Inflation & Labor' | 'Volatility & Liquidity';
  description: string;
  sparkline: number[];
}

export interface ScreenerItem {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  marketCap: string;
  marketCapNum: number;
  peRatio: number;
  volume: string;
  rsi: number;
}

export interface HeatmapItem {
  symbol: string;
  name: string;
  change: number;
  price: number;
  marketCap: string;
  weight: number;
}

export interface HeatmapSector {
  name: string;
  change: number;
  items: HeatmapItem[];
}

export type ThemeId = 'hybrid' | 'bloomberg' | 'wallstreet' | 'retro';

export type LayoutMode = 'default' | 'trading' | 'xauusd' | 'macro' | 'crypto' | 'cli-focused';

export type WidgetId =
  | 'chart'
  | 'quote'
  | 'watchlist'
  | 'news'
  | 'screener'
  | 'heatmap'
  | 'crypto'
  | 'macro'
  | 'cli'
  | 'xau-telemetry'
  | 'xau-orderbook'
  | 'crypto-ticker'
  | 'paper-trading'
  | 'position-calculator'
  | 'macro-correlation'
  | 'alerts-manager'
  | 'backtest'
  | 'pine-editor'
  | 'account-manager'
  | 'webhook-manager'
  | 'level2-book'
  | 'algo-bots'
  | 'macro-calendar'
  | 'fix-inspector'
  | 'layout-manager'
  | 'tick-replay'
  | 'wasm-matching'
  | 'portfolio-var'
  | 'fix-session'
  | 'subaccount-risk'
  | 'order-flow';

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
}

export interface CommandLog {
  id: string;
  command: string;
  timestamp: string;
  status: 'success' | 'error' | 'info';
  output: string;
}

export type MtfLayoutMode = '1x1' | '1x2' | '2x2';

export interface PaperPosition {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number; // 1 lot = 100 oz for gold
  entryPrice: number;
  currentPrice: number;
  sl?: number;
  tp?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marginUsed: number;
  openTime: string;
  // Module 1: Institutional extensions
  trailingStopDistance?: number;
  highWaterMark?: number;
  ocoGroupId?: string;
}

export type PaperOrderType = 'market' | 'limit' | 'stop' | 'oco' | 'trailing_stop' | 'iceberg';

export interface PaperOrder {
  id: string;
  symbol: string;
  type: PaperOrderType;
  side: 'buy' | 'sell';
  lots: number;
  targetPrice: number;
  sl?: number;
  tp?: number;
  createdAt: string;
  status: 'pending' | 'filled' | 'cancelled';
  // Module 1: Institutional extensions
  ocoGroupId?: string;
  linkedOrderId?: string;
  trailingDistance?: number;
  highWaterMark?: number;
  totalLots?: number;
  visibleLots?: number;
  executedLots?: number;
}

export interface PaperTradeJournalEntry {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  openTime: string;
  closeTime: string;
  reason: 'manual' | 'sl' | 'tp' | 'trailing_sl' | 'liquidation' | 'circuit_breaker' | 'oco_cancel';
}

export interface PaperAccountState {
  id: string;
  name: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number; // e.g. 10, 20, 50, 100
  currency: string;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  // Module 4: Risk limits & circuit breaker
  initialBalance: number;
  dailyStartingEquity: number;
  maxDailyDrawdownPercent: number; // e.g. 5%
  isCircuitBreakerTripped: boolean;
  circuitBreakerExpiry: string | null;
}

export interface AccountVault extends PaperAccountState {
  positions: PaperPosition[];
  orders: PaperOrder[];
  history: PaperTradeJournalEntry[];
  createdAt: string;
}

export interface MacroAssetQuote {
  symbol: string;
  name: string;
  category: 'metal' | 'crypto' | 'forex' | 'energy';
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  history: number[];
  correlationWithGold: number; // -1.00 to +1.00
  lastUpdated: string;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  percentage: number;
  isPoc: boolean;
  inValueArea: boolean;
}

export interface VolumeProfileResult {
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  levels: VolumeProfileLevel[];
}

export interface SessionLiquidityLevels {
  pdh: number;
  pdl: number;
  asianHigh?: number;
  asianLow?: number;
  londonHigh?: number;
  londonLow?: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'crosses_above' | 'crosses_below';
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
  note?: string;
}

// Module 2: Strategy Backtesting Models
export type BacktestStrategyType = 'sma_crossover' | 'rsi_mean_reversion' | 'macd_crossover';

export interface BacktestParams {
  strategy: BacktestStrategyType;
  timeframe: Timeframe;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  atrStopMult?: number;
  initialCapital: number;
  lotSize: number;
}

export interface BacktestTrade {
  id: string;
  entryTime: string;
  exitTime: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  reason: 'signal' | 'sl' | 'tp' | 'reversal';
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: { time: string; equity: number; drawdown: number }[];
  trades: BacktestTrade[];
}

// Module 3: Pine Script Engine Models
export interface PinePlot {
  title: string;
  color: string;
  values: (number | null)[];
  style?: 'line' | 'histogram' | 'cross';
}

export interface PineHline {
  price: number;
  title: string;
  color: string;
  style?: 'dashed' | 'solid';
}

export interface PineScriptResult {
  plots: PinePlot[];
  hlines: PineHline[];
  errors: string[];
  logs: string[];
}

export interface CustomPineScript {
  id: string;
  name: string;
  code: string;
  lastRun?: string;
}

// Module 5: Webhook & Telegram Models
export interface WebhookConfig {
  enabled: boolean;
  discordWebhookUrl?: string;
  genericWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  notifyOnOrderFill: boolean;
  notifyOnSlTpHit: boolean;
  notifyOnPriceAlert: boolean;
  notifyOnCircuitBreaker: boolean;
}

export interface WebhookLogItem {
  id: string;
  timestamp: string;
  type: 'discord' | 'telegram' | 'generic';
  event: 'order_fill' | 'sl_hit' | 'tp_hit' | 'price_alert' | 'circuit_breaker' | 'test';
  status: 'success' | 'failed';
  payload: string;
  responseStatus?: number;
}

// Phase III Module 1: Level 2 Depth & Time and Sales Models
export interface DepthLevel {
  price: number;
  amount: number;
  total: number;
  depthPercent: number;
}

export interface Level2OrderBook {
  bids: DepthLevel[];
  asks: DepthLevel[];
  midPrice: number;
  spread: number;
  spreadBps: number;
  imbalancePercent: number; // positive = buy wall dominance, negative = sell wall
  lastUpdated: number;
}

export interface TapeTrade {
  id: string;
  price: number;
  amount: number;
  timestamp: number;
  side: 'buy' | 'sell';
  isSweep: boolean;
}

// Phase III Module 2: Algo Trading Bot Models
export type AlgoStrategyId = 'vwap_reversion' | 'momentum_breakout';

export interface AlgoBotConfig {
  id: string;
  name: string;
  strategy: AlgoStrategyId;
  enabled: boolean;
  symbol: string;
  lotSize: number;
  maxPositions: number;
  vwapSdThreshold?: number; // e.g. 1.5 SD
  stopLossDollars?: number;
  takeProfitDollars?: number;
}

export interface AlgoBotLog {
  id: string;
  timestamp: string;
  botId: string;
  strategy: string;
  action: 'ENTRY' | 'EXIT' | 'SCAN' | 'RISK_HALT';
  message: string;
  price?: number;
}

export interface AlgoBotTelemetry {
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  realizedPnl: number;
  activePositionsCount: number;
  status: 'ACTIVE' | 'PAUSED' | 'HALTED';
}

// Phase III Module 3: Macroeconomic Economic Calendar & News Sentiment
export interface EconomicEvent {
  id: string;
  title: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'XAU';
  dateUtc: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actual?: string;
  forecast?: string;
  previous?: string;
  countdownMinutes?: number;
}

export interface NewsSentimentReport {
  bullishScore: number;
  bearishScore: number;
  netSentiment: number; // -1.0 to +1.0
  sentimentLabel: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sampleCount: number;
  topKeywords: { word: string; count: number; sentiment: 'bullish' | 'bearish' }[];
}

// Phase III Module 4: Multi-Monitor & Floating Window Panes
export type WorkspacePreset = 'default_scalper' | 'macro_swing' | 'full_desk' | 'algo_quant' | 'hft_depth';

export interface FloatingPaneState {
  id: string;
  title: string;
  widgetId: WidgetId;
  isOpen: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  isPoppedOut: boolean;
}

// Phase III Module 5: FIX 4.4 Protocol Simulator & Audit Trail
export interface FixTag {
  tag: number;
  name: string;
  value: string;
  description: string;
}

export interface FixMessage {
  id: string;
  raw: string;
  msgType: '35=D' | '35=8' | '35=F' | '35=0' | '35=A' | '35=9' | '35=G' | '35=5' | '35=1' | '35=2' | '35=3';
  typeLabel: string;
  senderCompId: string;
  targetCompId: string;
  seqNum: number;
  timestamp: string;
  tags: FixTag[];
}

// =========================================================================
// PHASE V: SOVEREIGN & ULTRA-LOW-LATENCY INSTITUTIONAL SUITE MODELS
// =========================================================================

// Module 1: High-Frequency Tick Data Replay & Historical Back-Simulation
export interface ReplayTick {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell';
  source: string;
  confidence?: number;
}

export type ReplayState = 'IDLE' | 'RECORDING' | 'PLAYING' | 'PAUSED';

export interface TickReplayStats {
  totalRecorded: number;
  currentReplayIndex: number;
  playbackSpeed: 1 | 2 | 5 | 10;
  startTime: number;
  endTime: number;
  slippageEstimatedBps: number;
  simulatedLatencyUs: number;
}

// Module 2: Wasm-Accelerated Order Matching & 50-Level L2 Depth Reconstructor
export type WasmOrderSide = 'BUY' | 'SELL';
export type WasmOrderType = 'LIMIT' | 'MARKET' | 'IOC' | 'FOK' | 'POST_ONLY';
export type WasmExecStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';

export interface WasmOrder {
  orderId: number;
  clientOrderId: string;
  side: WasmOrderSide;
  orderType: WasmOrderType;
  price: number;
  quantity: number;
  filledQuantity: number;
  timestampNs: number;
}

export interface WasmExecutionReport {
  execId: string;
  orderId: number;
  clientOrderId: string;
  execStatus: WasmExecStatus;
  side: WasmOrderSide;
  lastPrice: number;
  lastQty: number;
  cumQty: number;
  leavesQty: number;
  avgPrice: number;
  timestampNs: number;
  latencyNs: number;
  fee: number;
}

export interface L2DepthTier {
  level: number;
  price: number;
  amount: number;
  total: number;
  depthRatio: number; // 0 to 1
  isLiquidityWall: boolean;
}

export interface Full50LevelDomBook {
  bids: L2DepthTier[];
  asks: L2DepthTier[];
  midPrice: number;
  microPrice: number; // Order book weighted mid price
  spread: number;
  spreadBps: number;
  bidDepthTotal: number;
  askDepthTotal: number;
  imbalanceRatio: number; // (BidVol - AskVol) / (BidVol + AskVol)
  lastUpdated: number;
}

// Module 3: Advanced Portfolio Value-at-Risk (VaR) & Macro Stress Testing
export interface VaRMetric {
  confidence: 95 | 99;
  horizonDays: number;
  parametricVaRDollars: number;
  parametricVaRPct: number;
  historicalVaRDollars: number;
  historicalVaRPct: number;
  expectedShortfallDollars: number; // CVaR
  expectedShortfallPct: number;
  portfolioVolatilityPct: number;
}

export interface StressTestScenario {
  id: string;
  name: string;
  category: 'GEOPOLITICAL' | 'MONETARY' | 'LIQUIDITY' | 'MACRO';
  description: string;
  goldShockPct: number;
  equityShockPct: number;
  cryptoShockPct: number;
  spreadMultiplier: number;
  projectedPortfolioPnL: number;
  projectedPortfolioPnLPct: number;
  marginCallRisk: 'LOW' | 'ELEVATED' | 'CRITICAL';
  postShockMarginRatio: number;
}

export interface RiskProfileSummary {
  portfolioEquity: number;
  freeMargin: number;
  marginUtilizationPct: number;
  effectiveLeverage: number;
  dailyParametricVaR95: VaRMetric;
  dailyParametricVaR99: VaRMetric;
  stressTests: StressTestScenario[];
  liquidationPriceLong?: number;
  liquidationPriceShort?: number;
}

// Module 4: FIX Protocol Session Management
export type FixSessionStatus = 'DISCONNECTED' | 'LOGON_SENT' | 'CONNECTED' | 'LOGOUT_SENT' | 'RESET';

export interface FixSessionState {
  sessionId: string;
  senderCompId: string;
  targetCompId: string;
  heartBtInt: number;
  inboundSeqNum: number;
  outboundSeqNum: number;
  status: FixSessionStatus;
  lastHeartbeatSent: number;
  lastHeartbeatReceived: number;
  messages: FixMessage[];
}

// Module 5: Multi-Tenant Sub-Account Risk & Capital Allocation Matrix
export type DeskId = 'alpha_scalper' | 'macro_swing' | 'arbitrage_clearing';

export interface SubAccountDesk {
  id: DeskId;
  name: string;
  code: string;
  allocatedCapital: number;
  allocatedCapitalPct: number;
  currentEquity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  maxLeverage: number;
  maxDailyLossLimitPct: number;
  currentDrawdownPct: number;
  maxLotSize: number;
  activePositionsCount: number;
  isLocked: boolean;
  lockReason?: string;
  autoRiskScaleDown: boolean;
}

export interface EmergencyPanicAuditLog {
  id: string;
  timestamp: string;
  cancelledOrdersCount: number;
  flattenedPositionsCount: number;
  totalLiquidatedValue: number;
  checksum: string;
  initiator: string;
}



