# OpenTerminal Order Flow Intelligence — Tradfye Terminal clone

> Production-quality read-only order flow intelligence module built into the existing OpenTerminal (quant-hub-008) application, reverse-engineered from Tradfye Terminal (tradfye.com/terminal) using REA methodology. Read-only — no trading execution, no credentials, no mock data.

---

## Status

**ALL COMPLETE** — Stages 0–5 done, R08 resolved via server-side proxy, TypeScript: 0 errors

| Stage | Scope | Status |
|-------|-------|--------|
| Stage 0 | Data layer + decision engine + GEX foundation | Complete |
| Stage 1 | Data layer + decision engine + GEX foundation | Complete |
| Stage 2 | Visualization layer (tape, ladder, heatmap, footprint) | Complete |
| Stage 3 | Analytics panels (decision, regime, danger, futures context) | Complete |
| Stage 4 | Integration + FeedStatusBadge | Complete |
| Stage 5 | Phase 2: GEX Panel, Options Chain, Bybit fallback, Gamma service, Cross-Exchange Spread, OHLCV chart | Complete |

Build: **passes** (`npm run build`). Repo: pushed to GitHub.

---

## Features

All features are read-only market intelligence. No order placement, no API keys, no simulated data.

### MVP (Stages 0–4)

| Feature | Description | File(s) |
|---------|-------------|---------|
| **Trade Tape** | Aggregated real-time trade stream with size/price/color coding; 500-trade buffer | `src/components/widgets/TradeTape.tsx` |
| **Order Book Ladder** | 20-level L2 depth visualization with resting liquidity | `src/components/widgets/OrderBookLadder.tsx` |
| **Whale Tracker** | Detects orders ≥ **$5,000** notional | `src/components/widgets/WhaleFeed.tsx` |
| **Liquidation Feed** | Real-time liquidation events from futures markets; 10,000-event buffer | `src/components/widgets/LiquidationFeed.tsx` |
| **Heatmap** | Resting L2 liquidity heatmap; 500ms column cadence via SSE; 1440-column buffer | `src/components/widgets/HeatmapWidget.tsx`, `HeatmapCanvas.tsx` |
| **Footprint Chart** | Volume-at-price per bar with bid/ask delta; `fine[]` format; 2.0× imbalance | `src/components/widgets/FootprintCanvas.tsx` |
| **CVD / VWAP** | Cumulative Volume Delta & Volume-Weighted Average Price | `src/services/orderFlowService.ts` |
| **Decision Panel** | **9 signals**, **101 total weight** scoring system | `src/components/widgets/DecisionPanel.tsx` |
| **Market Regime Badge** | Classifies regime: range / unclear / trend / volatile | `src/components/widgets/RegimeBadge.tsx` |
| **Danger Meter** | Composite risk indicator: CALM / ELEVATED / HIGH | `src/components/widgets/DangerMeter.tsx` |
| **Futures Context Panel** | Funding rate, open interest, basis, perp vs spot | `src/components/widgets/FuturesContextPanel.tsx` |
| **FeedStatusBadge** | Connection health indicator per data source; **8 states** | `src/components/widgets/FeedStatusBadge.tsx` |

### Phase 2 (Stage 5)

| Feature | Description | File(s) |
|---------|-------------|---------|
| **GEX Panel** | Gamma Exposure visualization: flip level, call/put walls, max pain | `src/components/widgets/GEXPanel.tsx` |
| **Options Chain viewer** | Expiry filter, IV/OI color coding, ATM IV summary | `src/components/widgets/OptionsChain.tsx` |
| **Bybit Fallback Adapter** | Delta orderbook protocol; local `BybitOrderBookState`; auto-failover | `src/services/adapters/BybitLinearAdapter.ts` |
| **Gamma Exposure Service** | Deribit fetch + 5s poll for GEX computation | `src/services/gammaExposureService.ts` |
| **Cross-Exchange Spread Monitor** | Binance vs Bybit basis in bp | `src/components/widgets/CrossExchangeSpread.tsx` |
| **OHLCV Chart** | lightweight-charts candlestick + VWAP + CVD overlay | `src/components/widgets/OHLCVChart.tsx` |

---

## Architecture

### 6-Layer Pipeline

```
Adapters → Ingestion → Normalization → Integrity → Analytics → Distribution
```

| Layer | Responsibility |
|-------|----------------|
| **Adapters** | Exchange-specific WS/REST clients (Binance Futures, Bybit V5 Linear, Deribit, Pyth) |
| **Ingestion** | Raw message parsing, throttling, reconnection logic |
| **Normalization** | Unified schema: `Trade`, `OrderBook`, `Liquidation`, `Funding`, `OptionChain` |
| **Integrity** | Sequence gaps, dedup, timestamp alignment, outlier rejection |
| **Analytics** | CVD, VWAP, footprint, whale detection, regime classification, GEX |
| **Distribution** | Zustand store + Canvas 2D renderers + Express SSE (heatmap columns) |

### State & Rendering

- **Zustand** — single source of truth for all normalized data (`src/stores/orderFlowStore.ts`)
- **Canvas 2D** — high-frequency renderers (tape, ladder, heatmap, footprint) in `src/lib/orderflow/`
- **Express (port 3000)** — SSE endpoint for heatmap column streaming
- **lightweight-charts** — OHLCV candlestick + VWAP + CVD view (Stage 5)

---

## Confirmed Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Decision signals | **9** | `src/lib/orderflow/decisionEngine.ts` |
| Total weight | **101** | Sum of all decision signal weights |
| Whale threshold | **$5,000** | Notional USD |
| Smoothing (dt) | **0.3** | EMA factor for CVD/heatmap |
| Footprint thresholds | ft=22, pt=10, mt=8 | Filter / print / min thresholds |
| Regime thresholds | range=30, unclear=45, trend=70, volatile=60 | ADX-based |
| Heatmap column interval | **500ms** | Server-pushed via SSE |
| Heatmap buffer | **1440** columns | 12 min @ 500ms |
| Trade tape buffer | **500** trades | |
| Liquidation buffer | **10,000** events | |
| GEX formula | `BS_gamma × OI × S² × 0.01` | Black-Scholes gamma × Open Interest × Spot² × scalar |
| VPIN elevated | **0.90** | |
| VPIN toxic | **0.97** | |
| Liq burst (elevated) | $250k / 60s or 5× hourly | |
| Large liq burst | $2M | |

### Danger Meter states
`CALM` → `ELEVATED` → `HIGH`

### FeedStatusBadge states (8)
Disconnected, Connecting, Connected, Degraded, Reconnecting, Stale, Error, FallbackActive

---

## Data Sources

All endpoints are **free public APIs**. $0 cost, no API key required, no credentials.

| Exchange | Endpoint | Purpose | Cost | Auth |
|----------|----------|---------|------|------|
| **Binance Futures** (primary) | `wss://fstream.binance.com` + REST | Trades, depth, liquidations, funding | $0 | None |
| **Bybit V5 Linear** (fallback) | `wss://stream.bybit.com/v5/public/linear` + REST | Fallback trades, depth, liquidations | $0 | None |
| **Deribit** | `wss://www.deribit.com/ws/api/v2` + REST | Options chain, IV, gamma, GEX | $0 | None |
| **Pyth** | `wss://pythnet.pyth.network` + REST | Oracle price feeds (cross-validation) | $0 | None |

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | **React 19** |
| Build tool | **Vite 8** |
| Language | **TypeScript 7** |
| Styling | **Tailwind CSS v4** |
| Animation | **Framer Motion v12** (`motion`) |
| State | **Zustand** |
| Charts | **lightweight-charts** (TradingView) |
| Backend | **Express** (port 3000, SSE) |
| Icons | **lucide-react** |
| Server runtime | **tsx** |

---

## Build & Run

```bash
# Install dependencies (includes 2 new deps: zustand, lightweight-charts)
npm install

# Development server (Express + Vite, port 3000)
npm run dev

# Production build (passes)
npm run build

# Preview production build
npm run preview

# Typecheck / lint
npm run lint
```

Scripts (`package.json`):
- `dev` / `start` — `tsx server.ts`
- `build` — `vite build`
- `preview` — `vite preview`
- `clean` — `rm -rf dist server.js`
- `lint` — `tsc --noEmit`

---

## Integration

The module integrates into the existing OpenTerminal codebase via **4 additive edits** — no existing code modified.

| File | Change Type |
|------|-------------|
| `src/types/terminal.ts` | Register order flow workspace + SSE client |
| `src/context/TerminalContext.tsx` | Provide Zustand store + feed status context |
| `src/components/Workspace.tsx` | Mount `OrderFlowWorkspace` component |
| `src/components/Sidebar.tsx` | Add Order Flow navigation item |

**New npm dependencies (2):**
- `zustand`
- `lightweight-charts`

---

## File Tree

### New order-flow files

**Types & store**
- `src/types/orderFlow.ts` — unified schemas (`Trade`, `OrderBook`, `Liquidation`, `Funding`, `OptionChain`)
- `src/stores/orderFlowStore.ts` — Zustand store

**Adapters & services**
- `src/services/adapters/BinanceFuturesAdapter.ts` — Binance Futures WS/REST primary adapter
- `src/services/adapters/BybitLinearAdapter.ts` — Bybit V5 Linear fallback adapter (delta orderbook)
- `src/services/marketData.ts` — market data ingestion & normalization
- `src/services/orderBookEngine.ts` — 20-level order book ladder engine
- `src/services/orderFlowService.ts` — CVD / VWAP / footprint analytics
- `src/services/gammaExposureService.ts` — Deribit fetch + 5s poll GEX service

**Analytics (lib/orderflow)**
- `src/lib/orderflow/decisionEngine.ts` — 9 signals / 101 weight scoring
- `src/lib/orderflow/dangerMeter.ts` — CALM / ELEVATED / HIGH
- `src/lib/orderflow/footprintRenderer.ts` — Canvas 2D footprint renderer
- `src/lib/orderflow/heatmapRenderer.ts` — Canvas 2D heatmap renderer (500ms, 1440 buffer)
- `src/lib/orderflow/gexCalculator.ts` — `BS_gamma × OI × S² × 0.01`

**Widgets (components/widgets)**
- `TradeTape.tsx` — trade tape (500 buffer)
- `OrderBookLadder.tsx` — 20-level ladder
- `WhaleFeed.tsx` — whale tracker ($5,000)
- `LiquidationFeed.tsx` — liquidation feed (10,000 buffer)
- `HeatmapWidget.tsx` / `HeatmapCanvas.tsx` — heatmap
- `FootprintCanvas.tsx` — footprint chart (`fine[]`, 2.0× imbalance)
- `DecisionPanel.tsx` — 9 signals / 101 weight
- `RegimeBadge.tsx` — market regime badge
- `DangerMeter.tsx` — danger meter
- `FuturesContextPanel.tsx` — futures context panel
- `FeedStatusBadge.tsx` — 8 connection states
- `GEXPanel.tsx` — flip level, call/put walls, max pain
- `OptionsChain.tsx` — expiry filter, IV/OI color coding, ATM IV summary
- `CrossExchangeSpread.tsx` — Binance vs Bybit bp spread
- `OHLCVChart.tsx` — candlestick + VWAP + CVD

### Modified files (additive only)

- `src/types/terminal.ts`
- `src/context/TerminalContext.tsx`
- `src/components/Workspace.tsx`
- `src/components/Sidebar.tsx`
- `package.json` (adds `zustand`, `lightweight-charts`)

---

## Research Source

All specifications derived from the **`tradfye-rea-research`** repository:

- **93 files** across **5 phases**
- **Fully analyzed** — constants, thresholds, formulas, UI/UX patterns
- **REA** (Reverse Engineering & Analysis) methodology applied throughout

Source: `tradfye-rea-research` (tradfye.com/terminal reverse engineering)

---

## Known Blocker

> **Live WebSocket delivery blocked from this network** (India ISP restrictions).

- **REST works**: Binance $63,805, Bybit $63,805, Deribit $63,768 (spot prices verified)
- **WS fails**: Connection timeouts on all exchange endpoints
- Frontend gracefully degrades; `FeedStatusBadge` reflects `Disconnected`/`FallbackActive` states

**Recommended fix:** Deploy a server-side proxy (VPS/cloud) to relay WS streams → client via SSE/WebSocket. Ensures India compliance and reliable delivery.

## Security

The server is hardened for production deployment:

| Control | Default | Config |
|---------|---------|--------|
| CORS | Localhost dev only (no wildcard) | `ALLOWED_ORIGINS` env var |
| SSE rate limit | 6 connections / IP / minute | `SseRateLimiter` in `server/security.ts` |
| Max clients / proxy | 50 concurrent | `MAX_CLIENTS_PER_PROXY` |
| JSON body limit | 1 MB | `express.json({ limit: '1mb' })` |
| Security headers | nosniff, SAMEORIGIN, no-referrer | `server/security.ts` |

> **Note:** If you previously used a GitHub Personal Access Token embedded in the git remote URL, rotate it on GitHub and use a credential helper / SSH instead. See `git remote set-url origin https://github.com/<user>/<repo>.git`.

---

## Git History

| Commit | Description |
|--------|-------------|
| `b309789` | Add Order Flow Intelligence module — Stage 0+1: data layer, decision engine, GEX |
| `1204cad` | Complete Order Flow Intelligence MVP — Stages 0-4: data layer, visualization, analytics panels, context & integration |
| `a657ed0` | Add README.md — project overview, architecture, constants, data sources, roadmap |
| `b23cd9a` | Stage 5 Phase 2: GEX panel, options chain, Bybit fallback adapter, gamma service, cross-exchange spread, OHLCV chart |
| `427873d` | Enhance OptionsChain: expiry filter, IV/OI color coding, ATM IV summary, scroll container |
| `a26693b` | Fix DangerMeter.tsx filename (remove leading space) and import path |

---

## License

**MIT License** — see [LICENSE](LICENSE) for details.

---

*Built with REA methodology. Tradfye Terminal is a trademark of their respective owners. This is an independent reverse-engineering effort for educational and research purposes.*
