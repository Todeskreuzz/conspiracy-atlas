import type { Db } from './db';
import { randomToken, sha256Hex, timingSafeEqual } from './crypto';
import { ApiError, unauthorized } from './errors';
import { readCookie } from './auth';

/** Visitor accounts. Separate from the admin session (own cookie, own table). */
export const USER_COOKIE = '__Host-ca_user';
export const USER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Upper bound of parallel sessions per account (older ones are dropped). */
export const MAX_SESSIONS_PER_USER = 10;

export interface UserSession {
  idHash: string;
  csrfToken: string;
  userId: number;
  username: string;
}

export function userCookie(token: string, maxAge = USER_SESSION_TTL_SECONDS): string {
  // Lax so that following a link to the site keeps the visitor signed in; writes need the CSRF token as well.
  return `${USER_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearUserCookie(): string {
  return `${USER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Recovery code shown once at sign-up: 4 groups of 5 characters without look-alikes. */
export function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{5}/g)!.join('-');
}

export function normalizeRecoveryCode(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40) : '';
}

export async function createUserSession(db: Db, userId: number): Promise<{ token: string; csrfToken: string }> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const expires = new Date(Date.now() + USER_SESSION_TTL_SECONDS * 1000).toISOString();
  await db.batch([
    db.stmt('DELETE FROM user_sessions WHERE expires_at < ?', new Date().toISOString()),
    db.stmt(
      `DELETE FROM user_sessions WHERE user_id = ? AND id_hash NOT IN
         (SELECT id_hash FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`,
      userId,
      userId,
      MAX_SESSIONS_PER_USER - 1,
    ),
    db.stmt('INSERT INTO user_sessions (id_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)', await sha256Hex(token), userId, csrfToken, expires),
  ]);
  return { token, csrfToken };
}

export async function loadUserSession(db: Db, req: Request): Promise<UserSession | null> {
  const token = readCookie(req, USER_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const idHash = await sha256Hex(token);
  const row = await db.first<{ csrf_token: string; expires_at: string; user_id: number; username: string; status: string }>(
    `SELECT s.csrf_token, s.expires_at, u.id AS user_id, u.username, u.status
     FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
    idHash,
  );
  if (!row || row.expires_at < new Date().toISOString() || row.status !== 'active') return null;
  return { idHash, csrfToken: row.csrf_token, userId: Number(row.user_id), username: String(row.username) };
}

/** Valid session plus CSRF token for every write. */
export async function requireUser(db: Db, req: Request): Promise<UserSession> {
  const session = await loadUserSession(db, req);
  if (!session) throw unauthorized();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrf = req.headers.get('X-CSRF-Token') ?? '';
    if (!timingSafeEqual(csrf, session.csrfToken)) throw new ApiError(403, 'csrf', 'Invalid CSRF token');
  }
  return session;
}
