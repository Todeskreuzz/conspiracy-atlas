import type { Env } from './env';
import type { Db } from './db';
import { randomToken, sha256Hex, timingSafeEqual, verifyPassword } from './crypto';
import { ApiError, unauthorized } from './errors';
import { isAdminUser, loadUserSession } from './users';

export const SESSION_COOKIE = '__Host-ca_admin';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface AdminSession {
  idHash: string;
  csrfToken: string;
  username: string;
  /** Signed in through a visitor account that has admin rights (not the secret admin login). */
  viaAccount?: boolean;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  // HttpOnly + Secure + SameSite=Strict; the __Host- prefix forbids Domain and requires Path=/.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function checkCredentials(env: Env, username: string, password: string): Promise<boolean> {
  const expectedUser = env.ADMIN_USERNAME ?? '';
  const userOk = timingSafeEqual(username, expectedUser);
  // Always run the hash to keep timing similar for wrong usernames.
  const passOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH ?? '');
  return userOk && passOk && expectedUser.length > 0;
}

export async function createSession(db: Db): Promise<{ token: string; csrfToken: string }> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.batch([
    db.stmt('DELETE FROM admin_sessions WHERE expires_at < ?', new Date().toISOString()),
    db.stmt('INSERT INTO admin_sessions (id_hash, csrf_token, expires_at) VALUES (?, ?, ?)', await sha256Hex(token), csrfToken, expires),
  ]);
  return { token, csrfToken };
}

export async function loadSession(db: Db, env: Env, req: Request): Promise<AdminSession | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const idHash = await sha256Hex(token);
    const row = await db.first<{ csrf_token: string; expires_at: string }>(
      'SELECT csrf_token, expires_at FROM admin_sessions WHERE id_hash = ?',
      idHash,
    );
    if (row && row.expires_at >= new Date().toISOString()) return { idHash, csrfToken: row.csrf_token, username: env.ADMIN_USERNAME ?? 'admin' };
  }
  // A signed-in visitor account with admin rights works as well (its own session and CSRF token).
  const user = await loadUserSession(db, req);
  if (user && (await isAdminUser(db, user.userId))) {
    return { idHash: user.idHash, csrfToken: user.csrfToken, username: `@${user.username}`, viaAccount: true };
  }
  return null;
}

export async function requireSession(db: Db, env: Env, req: Request): Promise<AdminSession> {
  const session = await loadSession(db, env, req);
  if (!session) throw unauthorized();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrf = req.headers.get('X-CSRF-Token') ?? '';
    if (!timingSafeEqual(csrf, session.csrfToken)) throw new ApiError(403, 'csrf', 'Invalid CSRF token');
  }
  return session;
}

export async function destroySession(db: Db, session: AdminSession): Promise<void> {
  if (session.viaAccount) return; // signing out of the account happens on the account page
  await db.run('DELETE FROM admin_sessions WHERE id_hash = ?', session.idHash);
}
