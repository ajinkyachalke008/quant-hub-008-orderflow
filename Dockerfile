# OpenTerminal Order Flow Intelligence — Production Docker Image
# Deploy this in a region where Binance/Bybit WS is accessible (US, EU, SG)
# The browser connects to this server, which relays market data via SSE.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:3000/api/proxy/status || exit 1

CMD ["npx", "tsx", "server.ts"]
