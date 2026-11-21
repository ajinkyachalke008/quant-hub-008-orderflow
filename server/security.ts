import type { Request, Response, NextFunction } from 'express';
import type { ServerResponse } from 'http';

/**
 * Configurable CORS origin allowlist.
 * - ALLOWED_ORIGINS env var: comma-separated list of origins (e.g. "https://myapp.com,http://localhost:5173")
 * - If unset/empty: allow same-origin (reflect the request's own origin header ONLY for localhost dev, 
 *   otherwise allow requests with no Origin header, i.e. same-origin/non-browser). 
 * - Never use wildcard '*' for credentialed/sensitive endpoints.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Allow requests with no Origin header (same-origin navigation, curl, server-to-server)
  if (!origin) {
    // Reflect nothing; same-origin requests don't need CORS headers
    return next();
  }

  // Dev convenience: allow localhost origins when no allowlist configured
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (allowed.includes(origin) || (allowed.length === 0 && isLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

/**
 * Basic security headers (helmet-lite). Safe for SSE (does not buffer).
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // Note: do NOT set Content-Security-Policy here — the SPA + Vite + inline charts
  // would need a very permissive policy; left to the reverse proxy in production.
  next();
}

/**
 * Simple in-memory fixed-window rate limiter for SSE connections.
 * Prevents a single IP from opening unlimited SSE streams.
 */
export class SseRateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(maxConnections = 6, windowMs = 60_000) {
    this.max = maxConnections;
    this.windowMs = windowMs;
    // Periodic cleanup of expired windows
    const timer = setInterval(() => this.sweep(), windowMs * 2);
    if (timer.unref) timer.unref();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, w] of this.windows) {
      if (now > w.resetAt) this.windows.delete(key);
    }
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  allow(ip: string): boolean {
    const now = Date.now();
    let w = this.windows.get(ip);
    if (!w || now > w.resetAt) {
      w = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(ip, w);
    }
    w.count += 1;
    return w.count <= this.max;
  }
}

/** Max concurrent SSE clients per proxy (symbol+exchange). */
export const MAX_CLIENTS_PER_PROXY = 50;

/**
 * Resolve a stable client IP (first hop in x-forwarded-for, else socket address).
 */
export function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export type { Request, Response, ServerResponse };