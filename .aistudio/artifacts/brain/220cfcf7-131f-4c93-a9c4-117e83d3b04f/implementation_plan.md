# OpenTerminal: Institutional XAU/USD Trading Terminal & Macro Suite

An institutional-grade, zero-mock-data quantitative trading platform engineered for live Gold Spot (XAU/USD) order execution, multi-asset macro correlation tracking, and order flow analytics.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been confirmed through Phase 1 requirements analysis:
> - **Paper Trading Margin Model**: Institutional 1:50 leverage ($2,000 margin per 100 oz Standard Lot) with live margin requirement, free margin, margin level %, and automated margin call / liquidation safeguards.
> - **Default Workspace Layout**: Dual-Pane 1x2 split displaying synchronized 15-minute tactical execution chart and 1-hour macro trend chart with linked crosshairs.
> - **Audio Alert Engine**: Crisp Bloomberg terminal dual-tone audio chime synthesized in real-time via the browser's native Web Audio API (no external asset downloads).

---

### 1. Overview & Core Concept

OpenTerminal transforms browser-based technical analysis into an institutional execution cockpit powered strictly by live, verified public data streams (Pyth Network Hermes SSE, Pyth Benchmarks, and Binance WebSockets).

- **What It Does**: Provides real-time millisecond-level gold spot pricing, multi-asset macro correlation matrices (Gold-to-Silver Ratio, Pearson $\rho$ with BTC, DXY proxies, and Crude Oil), paper trading execution with visual chart orders, a dynamic Volume Profile Visible Range (VPVR) engine, position sizing risk calculator, and keyboard-driven CLI terminal controls.
- **Target Audience**: Quantitative traders, commodity macro analysts, and technical prop traders requiring zero latency, accurate math, and institutional execution mechanics.
- **Key Value**: Replaces simulated or delayed retail charting with real oracle-grade feeds, mathematical volume profiles (POC/VAH/VAL), and interactive paper execution without requiring API keys or subscriptions.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Market Intake & Macro Scan**:
   - The user opens OpenTerminal and immediately views the live Dual-Pane 1x2 workspace (15m execution chart + 1h trend chart) streaming real Pyth Hermes oracle prices (~$4,040/oz) with active confidence bands ($\pm\$0.30$) and live connection latency telemetry.
   - The right-hand / bottom dock displays the Multi-Asset Macro Watchlist streaming live prices for XAU/USD, XAG/USD, BTC/USD, EUR/USD, USD/JPY, and WTI/USD, alongside a live rolling 1-hour Pearson correlation matrix and real-time Gold-to-Silver Ratio (GSR).
2. **Order Flow & Volume Profile Analysis**:
   - The user toggles the VPVR overlay on the active chart to inspect horizontal volume distribution, identifying high-volume institutional nodes (Point of Control [POC]), Value Area High (VAH), Value Area Low (VAL, 70% volume region), and Previous Day High/Low (PDH/PDL) session sweeps.
3. **Risk Management & Position Sizing**:
   - The user inputs their account equity ($100,000 USD default) and desired risk tolerance (e.g. 1.0%) into the Position Size & Lot Calculator.
   - The calculator outputs exact Standard Lots (100 oz), Mini Lots (10 oz), and Micro Lots (1 oz), required margin under 1:50 leverage, pip risk, and 1:2 / 1:3 reward targets.
4. **Interactive Paper Execution**:
   - Orders can be executed via 1-click BUY/SELL market buttons, chart-click limit orders, or CLI commands (`buy 0.5 sl 4020 tp 4080`).
   - Active positions and pending orders render interactive draggable horizontal dashed lines on the chart (Green for Entry, Red for SL, Teal for TP).
   - Price tick crossings automatically trigger limit fills and stop-loss/take-profit liquidations, playing a Bloomberg dual-tone chime and persisting the trade journal to `localStorage`.
5. **CLI Power Tools & Journal Export**:
   - The user types commands into the persistent bottom terminal prompt (`alert price > 4050`, `export csv`, `snapshot`, `layout 2x2`).
   - The user can export the complete trade journal (realized P&L, timestamps, lot sizes, fees) to a formatted CSV file with one click.

#### Visual Identity & Theme
- **Aesthetic Direction**: High-density institutional financial terminal adhering to the Multi-Theme Terminal Engine (Hybrid Pro default, Bloomberg Amber, Wall Street Slate, and Retro CRT Phosphor).
- **Color Palette & Discipline**:
  - *Canvas (60%)*: Deep Obsidian (`#07090E`) base canvas with Modern Slate (`#111622`) elevated panels and 1px hairline borders (`rgba(255, 255, 255, 0.08)`).
  - *Surfaces & Cards (30%)*: Monolithic flat panels with zero nested card sandwiches and clean hairline dividers.
  - *Accents (10%)*: Bloomberg Amber (`#FFB000`) for headers and gold focus; Emerald (`#00E676`) for profit/longs; Crimson (`#FF3B30`) for losses/shorts; High-contrast Cyan (`#00F0FF`) for active crosshairs and prompts.
- **Typography & Tabular Discipline**:
  - Display & Headings: `Plus Jakarta Sans` / `Outfit` with balanced headline tracking.
  - Telemetry & Numbers: Strict tabular figures (`font-mono tabular-nums`, `JetBrains Mono`) for all tick prices, spreads, quantities, and P&L readouts.
- **Top Bar Contract**:
  - Single-line wordmark: `OpenTerminal // XAU/USD PRO`
  - Concise navigation tabs: `Trade Terminal`, `Macro Matrix`, `Order Flow`, `Risk Desk`, `Journal`
  - Action zone: Dual-pane layout toggle, audio mute switch, and 1-click theme selector.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real-Time Multi-Asset Stream Pipeline**
  - *Chosen Approach*: Pyth Hermes SSE stream for high-fidelity spot oracle pricing and confidence intervals, paired with Binance WebSocket multiplexing for sub-second macro asset ticks (BTC, EUR, JPY, Oil, and Silver).
  - *Why*: Delivers guaranteed zero-mock live data with sub-100ms updates without requiring API keys or exceeding rate limits.
  - *Alternatives Considered*: Polling free REST APIs was rejected due to 10-60s staleness and rate-limiting blocks.
- **Decision 2: Institutional 1:50 Margin Calculation Engine**
  - *Chosen Approach*: Standard FX/Commodity margin model: $\text{Required Margin} = \frac{\text{Lots} \times 100 \times \text{Spot Price}}{50}$. Account Free Margin, Margin Level % ($\frac{\text{Equity}}{\text{Used Margin}} \times 100$), and automated margin call warnings at $<100\%$ margin level.
  - *Why*: Accurately mirrors real prop firm and broker risk parameters.
  - *Alternatives Considered*: Simple 1:1 spot cash balance lacks real leverage dynamics and liquidation mechanics.
- **Decision 3: Volume Profile Visible Range (VPVR) Computation**
  - *Chosen Approach*: Mathematical price-bucketing algorithm computed directly from visible OHLCV bars and intraday candle volume, determining the 70% Value Area (VAH/VAL) and Point of Control (POC) dynamically as the user zooms or pans the chart.
  - *Why*: Instant client-side performance without server-side tick-storage overhead.
- **Decision 4: Native Browser Audio Synthesis**
  - *Chosen Approach*: Web Audio API `AudioContext` dual-sine oscillator with envelope decay producing a crisp 800Hz + 1200Hz dual chime for execution fills and threshold alerts.
  - *Why*: Instantaneous response, zero network payload, zero risk of broken audio URLs.

---

### 4. Technical Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          OpenTerminal Shell                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ TopBar: Wordmark | Live Feed HUD | MTF Layout | Theme | Audio    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────┬──────────────────────────────────────────┐  │
│  │ Workspace Grid        │ Macro & Execution Dock                   │  │
│  │ (1x1, 1x2, 2x2)       │                                          │  │
│  │                       │ ┌──────────────────────────────────────┐ │  │
│  │ ┌───────────────────┐ │ │ Macro Watchlist & Correlation Matrix │ │  │
│  │ │ Chart Pane 1 (15m)│ │ │ (XAU, XAG, BTC, EUR, JPY, WTI)       │ │  │
│  │ │ - Real Candlestick│ │ └──────────────────────────────────────┘ │  │
│  │ │ - VPVR & POC/VAH  │ │ ┌──────────────────────────────────────┐ │  │
│  │ │ - Interactive SL  │ │ │ Position Size & Lot Calculator       │ │  │
│  │ │ - Crosshair Sync  │ │ │ (Risk %, Lot tiers, 1:2 R:R targets) │ │  │
│  │ └───────────────────┘ │ └──────────────────────────────────────┘ │  │
│  │ ┌───────────────────┐ │ ┌──────────────────────────────────────┐ │  │
│  │ │ Chart Pane 2 (1h) │ │ │ Live Paper Execution & Orders Table  │ │  │
│  │ │ - Macro Structure │ │ │ (1:50 Margin, Unrealized P&L, SL/TP) │ │  │
│  │ │ - Session Sweeps  │ │ └──────────────────────────────────────┘ │  │
│  │ └───────────────────┘ │ ┌──────────────────────────────────────┐ │  │
│  │                       │ │ Audio & Price Alerts Manager         │ │  │
│  │                       │ └──────────────────────────────────────┘ │  │
│  └───────────────────────┴──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Interactive CLI Terminal & Power Engine (buy/sell/export/alert)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             Services & State Architecture              │
       ├────────────────────────────┬───────────────────────────┤
       │ xauusdDataService.ts       │ Live Pyth SSE + Binance WS│
       │ macroStreamService.ts      │ Multi-Asset live streams  │
       │ paperTradingEngine.ts      │ 1:50 Margin + localStorage│
       │ volumeProfileEngine.ts     │ VPVR, POC, VAH/VAL math   │
       │ audioAlertService.ts       │ Web Audio API Synthesizer │
       │ commandEngine.ts           │ CLI Parser & CSV Exporter │
       └────────────────────────────┴───────────────────────────┘
```

#### Core Module Implementation Blueprint

1. **`src/services/macroStreamService.ts`**:
   - Manages simultaneous live streams for `XAU/USD`, `XAG/USD`, `BTC/USD`, `EUR/USD`, `USD/JPY`, and `WTI/USD`.
   - Computes live Gold-to-Silver Ratio: $\text{GSR} = \frac{P_{\text{XAU}}}{P_{\text{XAG}}}$.
   - Calculates 1-hour rolling Pearson correlation coefficient ($\rho = \frac{\sum (x - \bar{x})(y - \bar{y})}{\sqrt{\sum (x - \bar{x})^2 \sum (y - \bar{y})^2}}$) between each macro asset and Gold Spot.
2. **`src/services/paperTradingEngine.ts`**:
   - Persists account state to `localStorage` (`virtual_balance: $100,000`, `positions`, `orders`, `history`).
   - Implements Market & Limit orders with user-defined or default Stop-Loss and Take-Profit.
   - Computes tick-by-tick Unrealized P&L: $(\text{Current Price} - \text{Entry Price}) \times \text{Lots} \times 100 \times \text{Direction}$.
   - Tracks Margin Used, Free Margin, and Margin Level %, triggering automatic liquidation if Margin Level drops below 50%.
3. **`src/services/volumeProfileEngine.ts`**:
   - Takes visible chart candle data, divides the price range into 50–100 discrete price buckets, and aggregates volume by price.
   - Identifies the Point of Control (POC, price with maximum volume) and calculates the Value Area (VAH and VAL enclosing 70% of total visible volume).
4. **`src/services/audioAlertService.ts`**:
   - Initializes a native browser `AudioContext` on user interaction.
   - Synthesizes the confirmed crisp Bloomberg dual-tone chime (F#5 740Hz + A#5 932Hz) with smooth exponential gain decay.
5. **`src/components/widgets/PositionSizeCalculatorWidget.tsx`**:
   - Calculates exact Standard (100 oz), Mini (10 oz), and Micro (1 oz) lot sizes from user's Account Equity, Risk % (0.5%–5%), Entry, and Stop Loss.
   - Displays required 1:50 margin, maximum dollar loss, and 1:2 / 1:3 reward targets.
6. **`src/components/widgets/MacroCorrelationWidget.tsx`**:
   - Displays real-time prices, 24h change %, GSR gauge, and Pearson correlation heat matrix with visual divergence/convergence status.
7. **`src/components/widgets/PaperTradingWidget.tsx`**:
   - Quick 1-click execution buttons, open positions table with live P&L, pending orders table, and trade journal history with Win Rate % and Profit Factor.
8. **`src/components/widgets/InteractiveChart.tsx` Enhancement**:
   - Renders VPVR horizontal histogram on the left or right of the active pane.
   - Plots interactive draggable SL/TP lines for open positions and pending limit orders.
   - Multi-pane synchronization (time and price cursor crosshairs aligned between 15m and 1h panes).
9. **`src/services/commandEngine.ts` & Terminal CLI**:
   - Commands: `buy <lots> [sl <price>] [tp <price>]`, `sell <lots> [sl <price>] [tp <price>]`, `close all`, `alert <price>`, `layout <1x1|1x2|2x2>`, `export csv`, `snapshot`.
   - `export csv` creates a clean, downloadable CSV file of all paper trading transactions.

---

### 5. Verification & Testing Checklist

- [ ] **Zero-Mock Verification**: Verify no `Math.random()` or simulated loops exist; all prices originate from live Pyth Hermes SSE / Binance streams.
- [ ] **Dual-Pane 1x2 Layout**: Verify 15m and 1h charts render side-by-side with synchronized crosshair tracking.
- [ ] **Volume Profile (VPVR)**: Verify POC, VAH, and VAL recalculate dynamically when switching intervals or panning visible bars.
- [ ] **1:50 Margin & P&L**: Verify margin used is calculated as $(\text{Lots} \times 100 \times \text{Price}) / 50$ and unrealized P&L updates on every live tick.
- [ ] **Audio Chime**: Verify crisp Bloomberg terminal dual-tone audio fires on limit fills, SL/TP triggers, and user-configured price alerts.
- [ ] **Full Build**: Run `lint_applet` and `compile_applet` to confirm 0 TypeScript or bundling errors.
