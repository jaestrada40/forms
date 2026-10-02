import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Rate limiting (in memory: counters reset when the API restarts)
// ---------------------------------------------------------------------------

interface Bucket { hits: number[]; blockedUntil?: number }

class SlidingWindow {
  private buckets = new Map<string, Bucket>();

  constructor(private windowMs: number, private max: number, private blockMs = 0) {
    // Periodic cleanup so the map cannot grow without bound
    setInterval(() => this.sweep(), Math.max(windowMs, 60_000)).unref();
  }

  private sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      bucket.hits = bucket.hits.filter(t => now - t < this.windowMs);
      if (bucket.hits.length === 0 && (!bucket.blockedUntil || bucket.blockedUntil < now)) this.buckets.delete(key);
    }
  }

  /** Seconds the caller must wait, or 0 when the key is not blocked. */
  retryAfter(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    const now = Date.now();
    if (bucket.blockedUntil && bucket.blockedUntil > now) return Math.ceil((bucket.blockedUntil - now) / 1000);
    bucket.hits = bucket.hits.filter(t => now - t < this.windowMs);
    return 0;
  }

  /** Records one hit. Returns true when this hit exceeded the limit. */
  hit(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter(t => now - t < this.windowMs);
    bucket.hits.push(now);
    if (bucket.hits.length > this.max) bucket.blockedUntil = now + (this.blockMs || this.windowMs);
    this.buckets.set(key, bucket);
    return bucket.hits.length > this.max;
  }

  reset(key: string) { this.buckets.delete(key); }
}

const tooMany = (res: Response, seconds: number) => {
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ message: `Demasiados intentos. Intente nuevamente en ${Math.ceil(seconds / 60) || 1} minuto(s).` });
};

/** Express middleware that limits requests per client key (default: IP). */
export function rateLimit(options: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const window = new SlidingWindow(options.windowMs, options.max);
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.key ? options.key(req) : (req.ip ?? 'unknown');
    const wait = window.retryAfter(key);
    if (wait) return tooMany(res, wait);
    if (window.hit(key)) return tooMany(res, Math.ceil(options.windowMs / 1000));
    next();
  };
}

/** Counts failed attempts (logins, MFA codes) per key and blocks the key for a while after too many. */
export class FailureLimiter {
  private window: SlidingWindow;
  constructor(windowMs: number, private maxFailures: number) {
    this.window = new SlidingWindow(windowMs, maxFailures - 1, windowMs);
  }
  /** Seconds left of the block, or 0. Call before checking credentials. */
  blockedFor(key: string) { return this.window.retryAfter(key); }
  fail(key: string) { this.window.hit(key); }
  succeed(key: string) { this.window.reset(key); }
  respond(res: Response, seconds: number) { return tooMany(res, seconds); }
}

// ---------------------------------------------------------------------------
// Cookies (the session lives in an HttpOnly cookie, out of reach of page scripts)
// ---------------------------------------------------------------------------

export const AUTH_COOKIE = 'formularios_auth';
const SESSION_SECONDS = 8 * 60 * 60;

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

const cookieAttributes = () => {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'Lax');
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
  return `Path=/; HttpOnly; SameSite=${sameSite}${secure || sameSite === 'None' ? '; Secure' : ''}`;
};

export const setAuthCookie = (res: Response, token: string) =>
  res.append('Set-Cookie', `${AUTH_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_SECONDS}; ${cookieAttributes()}`);

export const clearAuthCookie = (res: Response) =>
  res.append('Set-Cookie', `${AUTH_COOKIE}=; Max-Age=0; ${cookieAttributes()}`);

// ---------------------------------------------------------------------------
// Headers, CSRF and input guards
// ---------------------------------------------------------------------------

/** Baseline hardening headers for a JSON API. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/** Rejects state-changing requests that come from another origin (CSRF defence on top of SameSite cookies). */
export function sameOriginOnly(allowedOrigin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Public form submissions are meant to be posted from the form page, which may live on another origin
    if (req.path.startsWith('/api/public/')) return next();
    const origin = req.headers.origin;
    if (origin && origin !== allowedOrigin) return res.status(403).json({ message: 'Origen no permitido.' });
    next();
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** app.param handler: ids in URLs must be UUIDs, otherwise answer 404 instead of letting the database fail. */
export function uuidParam(_req: Request, res: Response, next: NextFunction, value: string) {
  if (!UUID.test(value)) return res.status(404).json({ message: 'No encontrado.' });
  next();
}

// ---------------------------------------------------------------------------
// Anti-spam challenge for public forms: a small arithmetic question, signed by the server (stateless),
// valid for 15 minutes and good for a single attempt.
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 15 * 60_000;
const usedChallenges = new Map<string, number>();
const challengeKey = () => crypto.createHash('sha256').update(`captcha:${process.env.JWT_SECRET ?? 'formularios'}`).digest();
const sign = (payload: string) => crypto.createHmac('sha256', challengeKey()).update(payload).digest('base64url');

export function createChallenge(): { question: string; token: string } {
  const a = crypto.randomInt(2, 12);
  const b = crypto.randomInt(2, 10);
  const minus = crypto.randomInt(0, 2) === 1 && a > b;
  const answer = minus ? a - b : a + b;
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const nonce = crypto.randomBytes(8).toString('base64url');
  return { question: `¿Cuánto es ${a} ${minus ? '−' : '+'} ${b}?`, token: `${exp}.${nonce}.${sign(`${exp}.${nonce}.${answer}`)}` };
}

/** True when the answer matches the token, the token has not expired and has not been used before. */
export function verifyChallenge(token: unknown, answer: unknown): boolean {
  if (typeof token !== 'string' || typeof answer !== 'string') return false;
  const [exp, nonce, signature] = token.split('.');
  if (!exp || !nonce || !signature || Number(exp) < Date.now() || usedChallenges.has(`${exp}.${nonce}`)) return false;
  // Every token gets a single attempt, right or wrong, so the answer cannot be guessed by retrying
  usedChallenges.set(`${exp}.${nonce}`, Number(exp));
  const expected = sign(`${exp}.${nonce}.${answer.trim()}`);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  // forget expired tokens so the map stays small
  for (const [key, expiresAt] of usedChallenges) if (expiresAt < Date.now()) usedChallenges.delete(key);
  return true;
}

// ---------------------------------------------------------------------------
// External captcha providers (server-side token verification)
// ---------------------------------------------------------------------------

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha';

const VERIFY_URLS: Record<CaptchaProvider, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
};

export interface CaptchaVerdict { ok: boolean; errors: string[]; unreachable?: boolean }

/** Asks the provider whether a widget token is valid. Network failures are reported as `unreachable`. */
export async function verifyExternalCaptcha(provider: CaptchaProvider, secret: string, siteKey: string, token: string, ip?: string): Promise<CaptchaVerdict> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  if (provider === 'hcaptcha' && siteKey) body.set('sitekey', siteKey);
  try {
    const response = await fetch(VERIFY_URLS[provider], { method: 'POST', body, signal: AbortSignal.timeout(6_000) });
    const data = await response.json() as { success?: boolean; 'error-codes'?: string[] };
    return { ok: data.success === true, errors: data['error-codes'] ?? [] };
  } catch {
    return { ok: false, errors: ['unreachable'], unreachable: true };
  }
}
