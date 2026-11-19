# OpenTerminal Order Flow Intelligence — Tradfye Terminal clone

> Production-quality read-only order flow intelligence module built into the existing OpenTerminal (quant-hub-008) application, reverse-engineered from Tradfye Terminal (tradfye.com/terminal) using REA methodology.

---

## Status

**MVP COMPLETE** — Stages 0–4 done, Stage 5 Phase 2 pending

---

## Features (MVP)

| Component | Description |
|-----------|-------------|
| **Trade Tape** | Real-time aggregated trade stream with size/price/color coding |
| **Order Book Ladder** | 20-level L2 depth visualization with resting liquidity |
| **Whale Tracker** | Detects orders ≥ **$5,000** notional |
| **Liquidation Feed** | Real-time liquidation events from futures markets |
| **Heatmap** | Resting L2 liquidity heatmap (500ms column cadence, 1440-column buffer) |
| **Footprint Chart** | Volume-at-price per bar with bid/ask delta |
| **CVD / VWAP** | Cumulative Volume Delta & Volume-Weighted Average Price |
| **Decision Panel** | **9 signals**, **101 total weight** scoring system |
| **Market Regime Badge** | Classifies regime: range / unclear / trend / volatile |
| **Danger Meter** | Composite risk indicator from multiple factors |
| **Futures Context Panel** | Funding rate, open interest, basis, perp vs spot |
| **FeedStatusBadge** | Connection health indicator per data source |

---

## Architecture

### 6-Layer Pipeline

```
Adapters → Ingestion → Normalization → Integrity → Analytics → Distribution
```

| Layer | Responsibility |
|-------|----------------|
| **Adapters** | Exchange-specific WS/REST clients (Binance, Bybit, Deribit, Pyth) |
| **Ingestion** | Raw message parsing, throttling, reconnection logic |
| **Normalization** | Unified schema: `Trade`, `OrderBook`, `Liquidation`, `Funding`, `OptionChain` |
| **Integrity** | Sequence gaps, dedup, timestamp alignment, outlier rejection |
| **Analytics** | CVD, VWAP, footprint, whale detection, regime classification, GEX |
| **Distribution** | Zustand store + Canvas 2D renderers + Express SSE (heatmap columns) |

### State & Rendering

- **Zustand** — single source of truth for all normalized data
- **Canvas 2D** — high-frequency renderers (tape, ladder, heatmap, footprint)
- **Express (port 3000)** — SSE endpoint for heatmap column streaming
- **lightweight-charts** — OHLCV chart view (Stage 5)

---

## Confirmed Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Decision signals | **9** | |
| Total weight | **101** | |
| Whale threshold | **$5,000** | Notional USD |
| Smoothing (dt) | **0.3** | EMA factor for CVD/heatmap |
| Footprint thresholds | ft=22, pt=10, mt=8 | Filter/print/min thresholds |
| Regime thresholds | range=30, unclear=45, trend=70, volatile=60 | ADX-based |
| Heatmap column interval | **500ms** | Server-pushed via SSE |
| Heatmap buffer | **1440** columns | 12min @ 500ms |
| Trade tape buffer | **500** trades | |
| Liquidation buffer | **10,000** events | |
| GEX formula | `BS_gamma × OI × S² × 0.01` | Black-Scholes gamma × Open Interest × Spot² × scalar |

---

## Data Sources

| Exchange | Endpoint | Purpose | Cost | Auth |
|----------|----------|---------|------|------|
| **Binance Futures** | `wss://fstream.binance.com` + REST | Primary trades, depth, liquidations, funding | $0 | None |
| **Bybit V5 Linear** | `wss://stream.bybit.com/v5/public/linear` + REST | Fallback trades, depth, liquidations | $0 | None |
| **Deribit** | `wss://www.deribit.com/ws/api/v2` + REST | Options chain, IV, gamma, GEX | $0 | None |
| **Pyth** | `wss://pythnet.pyth.network` + REST | Oracle price feeds (cross-validation) | $0 | None |

> All endpoints are **free public APIs**. No API keys required. $0 data cost.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | **React 19** |
| Build | **Vite 8** |
| Language | **TypeScript 7** |
| Styling | **Tailwind CSS v4** |
| Animation | **Framer Motion v12** |
| State | **Zustand** |
| Charts | **lightweight-charts** (TradingView) |
| Backend | **Express** (port 3000, SSE) |

---

## Build & Run

```bash
# Install dependencies (includes 2 new deps: zustand, lightweight-charts)
npm install

# Development server (port 3000)
npm run dev

# Production build (passes)
npm run build

# Preview production build
npm run preview
```

---

## Integration

This module integrates into the existing OpenTerminal codebase via **4 additive edits**:

| File | Change Type |
|------|-------------|
| `terminal.ts` | Register order flow workspace + SSE client |
| `TerminalContext.tsx` | Provide Zustand store + feed status context |
| `Workspace.tsx` | Mount `OrderFlowWorkspace` component |
| `Sidebar.tsx` | Add Order Flow navigation item |

**New npm dependencies (2):**
- `zustand`
- `lightweight-charts`

No existing code modified — purely additive.

---

## Research Source

All specifications derived from **[`tradfye-rea-research`](https://github.com/.../tradfye-rea-research)** repository:

- **93 files** across **5 phases**
- **Fully analyzed** — constants, thresholds, formulas, UI/UX patterns
- REA (Reverse Engineering & Analysis) methodology applied

---

## Known Blocker

> **Live WebSocket delivery blocked from this network** (India ISP restrictions).
>
> - **REST works**: Binance $63,805, Bybit $63,805, Deribit $63,768 (spot prices verified)
> - **WS fails**: Connection timeouts on all exchange endpoints
>
> **Recommended fix**: Deploy server-side proxy (VPS/cloud) to relay WS streams → client via SSE/WebSocket. Ensures India compliance and reliable delivery.

---

## Stage 5 Roadmap

| Phase | Item | Description |
|-------|------|-------------|
| **5.1** | GEX Panel | Gamma Exposure visualization from Deribit options chain |
| **5.1** | Options Chain UI | Strikes, IV, gamma, OI per expiry |
| **5.1** | Bybit Fallback Adapter | Auto-failover when Binance WS degrades |
| **5.2** | Historical Heatmap Scroll | Time-travel through 1440-column buffer |
| **5.2** | Cross-Exchange Spread Monitor | Binance vs Bybit basis / funding arb |
| **5.2** | OHLCV lightweight-charts View | Integrated candlestick + volume chart |

---

## License

**MIT License** — see [LICENSE](LICENSE) for details.

---

*Built with REA methodology. Tradfye Terminal is a trademark of their respective owners. This is an independent reverse-engineering effort for educational and research purposes.*