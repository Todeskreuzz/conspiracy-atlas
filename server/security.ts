import type { Env } from './env';
import { sha256Hex } from './crypto';
import type { Db } from './db';
import { ApiError, UnavailableError } from './errors';
import { turnstileConfigured } from './features';

/** Client IP as seen by Cloudflare. Used only transiently and only in hashed form. */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'local';
}

/**
 * Fixed-window rate limiter backed by D1. Keys are salted SHA-256 hashes; rows older than one day are purged.
 * Throws 429 when the limit is exceeded.
 */
export async function rateLimit(db: Db, env: Env, req: Request, bucket: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const keyHash = await sha256Hex(`${env.SESSION_SECRET || 'local-dev-salt'}|${bucket}|${clientIp(req)}`);
  const row = await db.first<{ count: number }>(
    `INSERT INTO rate_limits (bucket, key_hash, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (bucket, key_hash, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
    bucket,
    keyHash,
    windowStart,
  );
  // Opportunistic cleanup (cheap, indexed) so hashes never accumulate.
  if (Math.random() < 0.05) await db.run('DELETE FROM rate_limits WHERE window_start < ?', now - 86400);
  if ((row?.count ?? 0) > limit) throw new ApiError(429, 'rate_limited', 'Too many requests. Please try again later.');
}

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Server-side Turnstile verification. Fails closed. */
export async function verifyTurnstile(env: Env, token: string | null | undefined, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!turnstileConfigured(env)) throw new UnavailableError('turnstile', 'not_configured');
  if (!token || typeof token !== 'string' || token.length > 4096) {
    throw new ApiError(400, 'turnstile_failed', 'Anti-spam verification is required.');
  }
  let ok = false;
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET_KEY as string);
    body.append('response', token);
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    const data = (await res.json()) as { success?: boolean };
    ok = data.success === true;
  } catch {
    throw new UnavailableError('turnstile', 'temporary_error');
  }
  if (!ok) throw new ApiError(400, 'turnstile_failed', 'Anti-spam verification failed. Please try again.');
}

/** Rejects cross-site state-changing requests (defence in depth next to the CSRF token). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('Origin');
  if (origin && origin !== new URL(req.url).origin) throw new ApiError(403, 'forbidden', 'Cross-origin request rejected');
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') throw new ApiError(403, 'forbidden', 'Cross-site request rejected');
}
