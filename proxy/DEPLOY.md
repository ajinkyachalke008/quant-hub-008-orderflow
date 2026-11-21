# Deployment Guide � OpenTerminal Order Flow Intelligence

## Overview

**R08**: Live WebSocket data from Binance/Bybit is blocked on Indian networks. The proxy server solves this by relaying market data over SSE from a VPS in a permitted region.

### Architecture

```
Browser (India)  --SSE-->  Express Proxy (US/EU/SG VPS)  --WS-->  Binance / Bybit
```

The browser connects to the proxy over SSE; the proxy maintains server-side WebSocket connections to the exchanges and fans data out to clients.

## Quick Start (VPS)

1. Provision a VPS in a permitted region (US/EU/Singapore).
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Clone the repo: `git clone <repo-url> && cd quant-hub-008`
4. `docker-compose up -d`
5. Point browser to `http://YOUR_VPS_IP:3000`

## Region Recommendations

| Region | Works? | Notes |
|--------|--------|-------|
| US East (Virginia) | ? | Low latency to Binance |
| US West (California) | ? | Good |
| EU (Frankfurt) | ? | Good latency |
| Singapore | ? | Best for Asia users |
| India | ? | Binance/Bybit WS blocked |
| China | ? | Both exchanges blocked |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Node environment |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse/binance/:symbol` | GET (SSE) | Binance Futures data (trades, depth, liquidations, mark price) |
| `/sse/bybit/:symbol` | GET (SSE) | Bybit Linear data (trades, orderbook, liquidations) |
| `/sse/gamma/:symbol` | GET (SSE) | Gamma Exposure profile (Deribit options) |
| `/api/deribit/options` | GET | Deribit options chain (REST proxy) |
| `/api/proxy/status` | GET | Proxy health check (all proxies + status) |
| `/api/quote/:symbol` | GET | Live quote (existing) |
| `/api/chart/:symbol` | GET | Candlestick chart (existing) |
| `/api/macro` | GET | Macro indicators (existing) |
| `/api/crypto` | GET | Crypto ticker board (existing) |

## Client Auto-Detection

The client adapter auto-detects the proxy:

- If running on port 3000 or in dev mode ? tries proxy first
- If proxy fails after 3s ? falls back to direct WS
- If on a different origin ? goes straight to direct WS

## Troubleshooting

- WS connection timeout: check region (India/China blocked)
- SSE not connecting: check CORS headers, firewall rules
- No data in SSE: check `/api/proxy/status` � proxies should be LIVE
- Deribit errors: Deribit may rate-limit; check 5s poll interval

## Security

### CORS
- The server no longer uses wildcard CORS (`*`).
- Allowed origins are configured via the `ALLOWED_ORIGINS` env var (comma-separated).
- If unset, only localhost dev origins are allowed (for local development).
- Production: set `ALLOWED_ORIGINS=https://your-frontend-domain.com`

### SSE Rate Limiting
- Max **6 SSE connections per client IP per minute** (configurable via `SseRateLimiter` in `server/security.ts`).
- Exceeding the limit returns HTTP `429 Too Many Requests`.
- Max **50 concurrent clients per proxy** (symbol+exchange). Excess connections are rejected cleanly.

### Security Headers (helmet-lite)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- Content-Security-Policy is intentionally NOT set by the app (the SPA + inline charts need a permissive policy); set it at your reverse proxy (nginx) in production.

### Request Body Limit
- JSON bodies are limited to **1 MB** (`express.json({ limit: '1mb' })`).

### Production Checklist
- [ ] Set `ALLOWED_ORIGINS` to your real frontend domain(s)
- [ ] Put nginx (or similar) in front with HTTPS (Let's Encrypt)
- [ ] Set a strict Content-Security-Policy at the reverse proxy
- [ ] Enable a firewall allowing only 80/443 inbound
- [ ] Consider `NODE_ENV=production` (serves static build, disables Vite middleware)

## Scaling

- One server-side WS connection per symbol (fan-out to N SSE clients)
- For multiple symbols, deploy multiple instances or use a load balancer
- SSE auto-reconnect built into EventSource
