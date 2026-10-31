import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../http';
import { readJson } from '../http';
import { Db, type Row } from '../db';
import { computeFeatures, requireFeature } from '../features';
import { ApiError, notFound } from '../errors';
import { assertSameOrigin, rateLimit, verifyTurnstile } from '../security';
import { hashPassword, randomToken, sha256Hex, toHex, timingSafeEqual, verifyPassword } from '../crypto';
import { THEORY_FIELDS, THEORY_SUMMARY_SELECT, mapTheorySummary, translate } from '../repo';
import { assertImageQuota } from '../images';
import { turnstileFetch } from './community';
import { ANIMATED_IMAGE_MAX_BYTES, IMAGE_LIMITS, PROFILE_IMAGE_MIME_TYPES, base64ToBytes, isGif, sniffImageMime } from '../../shared/images';
import {
  PROFILE_IMAGE_SLOTS,
  normalizeUsername,
  parseStoredProfile,
  validateDisplayName,
  validatePassword,
  validateProfile,
  type AccountUser,
  type ProfileImageInfo,
  type ProfileSubmission,
  type PublicProfile,
} from '../../shared/profile';
import { ValidationError, int, oneOf } from '../../shared/validation';
import {
  clearUserCookie,
  createUserSession,
  canUseAnimated,
  isAdminUser,
  loadUserSession,
  normalizeRecoveryCode,
  recoveryCode,
  requireUser,
  userCookie,
  type UserSession,
} from '../users';

/**
 * Visitor accounts and profile pages. Everything is stored in D1 (free plan): no e-mail service,
 * so a forgotten password is reset with the recovery code shown once at sign-up.
 */
export const accountRoutes = new Hono<AppEnv>();

/** Same cost for unknown usernames, so login timing does not reveal which accounts exist. */
const DUMMY_HASH = `pbkdf2_sha256$100000$${'0'.repeat(32)}$${'0'.repeat(64)}`;

const recoveryHash = (username: string, code: string) => sha256Hex(`recovery|${username}|${normalizeRecoveryCode(code)}`);

function imageInfo(publicId: unknown): ProfileImageInfo | null {
  return typeof publicId === 'string' && publicId ? { url: `/api/images/${publicId}`, status: 'approved' } : null;
}

const USER_SELECT = `
  SELECT u.*, av.public_id AS avatar_id, bn.public_id AS banner_id FROM users u
  LEFT JOIN profile_images av ON av.user_id = u.id AND av.slot = 'avatar'
  LEFT JOIN profile_images bn ON bn.user_id = u.id AND bn.slot = 'banner'`;

function mapAccountUser(r: Row): AccountUser {
  return {
    id: Number(r.id),
    username: String(r.username),
    displayName: String(r.display_name),
    avatarUrl: imageInfo(r.avatar_id)?.url ?? null,
    createdAt: String(r.created_at),
  };
}

async function sessionJson(db: Db, userId: number, csrfToken: string) {
  const row = await db.first(`${USER_SELECT} WHERE u.id = ?`, userId);
  if (!row) throw notFound('Account');
  return { authenticated: true, available: true, csrfToken, user: { ...mapAccountUser(row), isAdmin: await isAdminUser(db, userId) } };
}

function guard(c: Ctx) {
  requireFeature(c.env, 'accounts');
  if (c.req.method !== 'GET') assertSameOrigin(c.req.raw);
}

// ---------------------------------------------------------------------------
// Sign-up, sign-in, recovery
// ---------------------------------------------------------------------------

accountRoutes.get('/account/me', async (c) => {
  const feature = computeFeatures(c.env).accounts;
  if (!feature.available) return c.json({ authenticated: false, available: false, state: feature.state, message: feature.message });
  const db = Db.from(c.env);
  const session = await loadUserSession(db, c.req.raw);
  if (!session) return c.json({ authenticated: false, available: true });
  return c.json(await sessionJson(db, session.userId, session.csrfToken));
});

accountRoutes.post('/account/register', async (c) => {
  guard(c);
  const body = await readJson(c, 5_000);
  const username = normalizeUsername(body.username);
  const password = validatePassword(body.password);
  const displayName = body.displayName ? validateDisplayName(body.displayName) : username;
  await verifyTurnstile(c.env, typeof body.turnstileToken === 'string' ? body.turnstileToken : null, turnstileFetch.impl);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'register', 5, 3600);
  if (await db.first('SELECT 1 FROM users WHERE username = ?', username)) {
    throw new ApiError(409, 'username_taken', 'This username is already taken', undefined, 'username');
  }
  const code = recoveryCode();
  const created = await db.first<{ id: number }>(
    'INSERT INTO users (username, password_hash, recovery_hash, display_name) VALUES (?, ?, ?, ?) RETURNING id',
    username,
    await hashPassword(password),
    await recoveryHash(username, code),
    displayName,
  );
  const { token, csrfToken } = await createUserSession(db, Number(created!.id));
  c.header('Set-Cookie', userCookie(token));
  return c.json({ ...(await sessionJson(db, Number(created!.id), csrfToken)), recoveryCode: code }, 201);
});

accountRoutes.post('/account/login', async (c) => {
  guard(c);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'user_login', 10, 900);
  const body = await readJson(c, 2_000);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase().slice(0, 40) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  const row = await db.first<{ id: number; password_hash: string; status: string }>('SELECT id, password_hash, status FROM users WHERE username = ?', username);
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new ApiError(401, 'invalid_credentials', 'Invalid username or password');
  if (row.status !== 'active') throw new ApiError(403, 'account_locked', 'This account has been locked by the editors.');
  const { token, csrfToken } = await createUserSession(db, Number(row.id));
  c.header('Set-Cookie', userCookie(token));
  return c.json(await sessionJson(db, Number(row.id), csrfToken));
});

accountRoutes.post('/account/logout', async (c) => {
  assertSameOrigin(c.req.raw);
  if (c.env.DB) {
    const db = Db.from(c.env);
    const session = await loadUserSession(db, c.req.raw);
    if (session) await db.run('DELETE FROM user_sessions WHERE id_hash = ?', session.idHash);
  }
  c.header('Set-Cookie', clearUserCookie());
  return c.json({ ok: true });
});

/** Forgotten password: the recovery code sets a new password, signs out everywhere and is replaced by a new code. */
accountRoutes.post('/account/recover', async (c) => {
  guard(c);
  const body = await readJson(c, 2_000);
  const username = normalizeUsername(body.username);
  const password = validatePassword(body.newPassword, 'newPassword');
  await verifyTurnstile(c.env, typeof body.turnstileToken === 'string' ? body.turnstileToken : null, turnstileFetch.impl);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'recover', 5, 3600);
  const row = await db.first<{ id: number; recovery_hash: string; status: string }>('SELECT id, recovery_hash, status FROM users WHERE username = ?', username);
  const given = await recoveryHash(username, String(body.recoveryCode ?? ''));
  if (!row || !timingSafeEqual(given, row.recovery_hash)) throw new ApiError(401, 'invalid_recovery', 'Username or recovery code is wrong');
  if (row.status !== 'active') throw new ApiError(403, 'account_locked', 'This account has been locked by the editors.');
  const code = recoveryCode();
  await db.batch([
    db.stmt("UPDATE users SET password_hash = ?, recovery_hash = ?, updated_at = datetime('now') WHERE id = ?", await hashPassword(password), await recoveryHash(username, code), row.id),
    db.stmt('DELETE FROM user_sessions WHERE user_id = ?', row.id),
  ]);
  const { token, csrfToken } = await createUserSession(db, Number(row.id));
  c.header('Set-Cookie', userCookie(token));
  return c.json({ ...(await sessionJson(db, Number(row.id), csrfToken)), recoveryCode: code });
});

// ---------------------------------------------------------------------------
// Signed-in account
// ---------------------------------------------------------------------------

type UserCtx = Ctx & { user?: UserSession };
const me = (c: Ctx) => (c as UserCtx).user!;

for (const path of ['/account/profile', '/account/password', '/account/recovery-code', '/account/images/*', '/account/submissions', '/account']) {
  accountRoutes.use(path, async (c, next) => {
    guard(c);
    (c as UserCtx).user = await requireUser(Db.from(c.env), c.req.raw);
    await next();
  });
}

async function checkPassword(db: Db, userId: number, password: unknown): Promise<void> {
  const row = await db.first<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', userId);
  if (!row || !(await verifyPassword(typeof password === 'string' ? password.slice(0, 200) : '', row.password_hash))) {
    throw new ApiError(403, 'wrong_password', 'The current password is wrong', undefined, 'currentPassword');
  }
}

/** Profile as stored, for the editor (includes private settings). */
accountRoutes.get('/account/profile', async (c) => {
  const db = Db.from(c.env);
  const row = await db.first(`${USER_SELECT} WHERE u.id = ?`, me(c).userId);
  if (!row) throw notFound('Account');
  return c.json({
    user: mapAccountUser(row),
    profile: parseStoredProfile(row.profile_json),
    avatar: imageInfo(row.avatar_id),
    banner: imageInfo(row.banner_id),
    allowAnimated: await canUseAnimated(db, Number(row.id), row.allow_animated),
  });
});

accountRoutes.put('/account/profile', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 60_000);
  const displayName = validateDisplayName(body.displayName);
  const profile = validateProfile(body.profile);
  await rateLimit(db, c.env, c.req.raw, 'profile_save', 60, 3600);
  await db.run(
    "UPDATE users SET display_name = ?, profile_json = ?, updated_at = datetime('now') WHERE id = ?",
    displayName,
    JSON.stringify(profile),
    me(c).userId,
  );
  return c.json({ ok: true, profile, displayName });
});

accountRoutes.put('/account/password', async (c) => {
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'password_change', 10, 3600);
  const body = await readJson(c, 2_000);
  const next = validatePassword(body.newPassword, 'newPassword');
  await checkPassword(db, me(c).userId, body.currentPassword);
  // Other devices are signed out; this one stays signed in.
  await db.batch([
    db.stmt("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", await hashPassword(next), me(c).userId),
    db.stmt('DELETE FROM user_sessions WHERE user_id = ? AND id_hash != ?', me(c).userId, me(c).idHash),
  ]);
  return c.json({ ok: true });
});

/** A new recovery code replaces the old one (e.g. after it was lost). */
accountRoutes.post('/account/recovery-code', async (c) => {
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'password_change', 10, 3600);
  const body = await readJson(c, 2_000);
  await checkPassword(db, me(c).userId, body.currentPassword);
  const code = recoveryCode();
  await db.run('UPDATE users SET recovery_hash = ? WHERE id = ?', await recoveryHash(me(c).username, code), me(c).userId);
  return c.json({ recoveryCode: code });
});

/** Deletes the account with its images and sessions. Published case files stay (their author name is kept). */
accountRoutes.delete('/account', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 2_000);
  await checkPassword(db, me(c).userId, body.currentPassword);
  // Profile images and sessions go with the account (ON DELETE CASCADE).
  await db.run('DELETE FROM users WHERE id = ?', me(c).userId);
  c.header('Set-Cookie', clearUserCookie());
  return c.json({ ok: true });
});

/** All own submissions with their moderation status (only the owner sees this list). */
accountRoutes.get('/account/submissions', async (c) => {
  const rows = await Db.from(c.env).all(
    `SELECT s.id, s.title, s.status, s.created_at, t.slug AS theory_slug FROM community_submissions s
     LEFT JOIN theories t ON t.id = s.published_theory_id AND t.is_published = 1
     WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 100`,
    me(c).userId,
  );
  return c.json({ items: rows.map(mapProfileSubmission) });
});

/**
 * Profile images: one avatar and one banner per account, public at once (editors can delete them).
 * Static images are re-encoded in the browser; animated GIFs are stored as uploaded and only accepted
 * for admins and for accounts an editor allowed (users.allow_animated).
 */
function parseProfileImage(raw: unknown, allowAnimated: boolean) {
  const o = (raw ?? {}) as Record<string, unknown>;
  const mime = oneOf(o.mime, 'image.mime', PROFILE_IMAGE_MIME_TYPES);
  const animated = mime === 'image/gif';
  if (animated && !allowAnimated) throw new ApiError(403, 'gif_not_allowed', 'Animated GIFs are not enabled for this account', undefined, 'image');
  const max = animated ? ANIMATED_IMAGE_MAX_BYTES : IMAGE_LIMITS.maxBytes;
  if (typeof o.data !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(o.data) || o.data.length > Math.ceil((max * 4) / 3) + 4) {
    throw new ValidationError('image', `invalid image or too large (max. ${Math.round(max / 1024)} KB)`);
  }
  const bytes = base64ToBytes(o.data);
  if (bytes.length === 0 || bytes.length > max) throw new ValidationError('image', `image too large (max. ${Math.round(max / 1024)} KB)`);
  const real = isGif(bytes) ? 'image/gif' : sniffImageMime(bytes);
  if (real !== mime) throw new ValidationError('image', 'file content does not match an allowed image type');
  return {
    bytes,
    mime,
    width: int(o.width, 'image.width', { min: 1, max: IMAGE_LIMITS.maxDimension }) as number,
    height: int(o.height, 'image.height', { min: 1, max: IMAGE_LIMITS.maxDimension }) as number,
  };
}

const MAX_PROFILE_IMAGE_BODY = Math.ceil((ANIMATED_IMAGE_MAX_BYTES * 4) / 3) + 4_000;

accountRoutes.put('/account/images/:slot', async (c) => {
  requireFeature(c.env, 'community_uploads');
  const slot = oneOf(c.req.param('slot'), 'slot', PROFILE_IMAGE_SLOTS);
  const body = await readJson(c, MAX_PROFILE_IMAGE_BODY);
  if (!body.image) throw new ValidationError('image', 'is required');
  const db = Db.from(c.env);
  const userId = me(c).userId;
  const user = await db.first<{ allow_animated: number }>('SELECT allow_animated FROM users WHERE id = ?', userId);
  const img = parseProfileImage(body.image, await canUseAnimated(db, userId, user?.allow_animated));
  await rateLimit(db, c.env, c.req.raw, 'profile_image', 20, 3600);
  const old = await db.first<{ size: number }>('SELECT size FROM profile_images WHERE user_id = ? AND slot = ?', userId, slot);
  await assertImageQuota(db, c.env, img.bytes.length - Number(old?.size ?? 0));
  const publicId = randomToken(12);
  const data = img.bytes.buffer.slice(img.bytes.byteOffset, img.bytes.byteOffset + img.bytes.byteLength);
  await db.batch([
    db.stmt('DELETE FROM profile_images WHERE user_id = ? AND slot = ?', userId, slot),
    db.stmt(
      `INSERT INTO profile_images (public_id, user_id, slot, mime, width, height, size, sha256, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      publicId, userId, slot, img.mime, img.width, img.height, img.bytes.length, toHex(await crypto.subtle.digest('SHA-256', img.bytes)), data,
    ),
    db.stmt("UPDATE users SET updated_at = datetime('now') WHERE id = ?", userId),
  ]);
  return c.json({ [slot]: imageInfo(publicId) }, 201);
});

accountRoutes.delete('/account/images/:slot', async (c) => {
  const slot = oneOf(c.req.param('slot'), 'slot', PROFILE_IMAGE_SLOTS);
  await Db.from(c.env).run('DELETE FROM profile_images WHERE user_id = ? AND slot = ?', me(c).userId, slot);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Public profile page
// ---------------------------------------------------------------------------

function mapProfileSubmission(r: Row): ProfileSubmission {
  return {
    id: Number(r.id),
    title: String(r.title),
    status: String(r.status),
    theorySlug: (r.theory_slug as string) ?? null,
    createdAt: String(r.created_at),
  };
}

accountRoutes.get('/users/:username', async (c) => {
  requireFeature(c.env, 'accounts');
  const username = String(c.req.param('username') ?? '').toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) throw notFound('Profile');
  const db = Db.from(c.env);
  const row = await db.first(`${USER_SELECT} WHERE u.username = ?`, username);
  const session = row ? await loadUserSession(db, c.req.raw) : null;
  const isOwner = !!row && session?.userId === Number(row.id);
  const profile = row ? parseStoredProfile(row.profile_json) : null;
  // Private and locked profiles look exactly like missing ones to everybody but the owner.
  if (!row || !profile || (!isOwner && (row.status !== 'active' || profile.visibility !== 'public'))) throw notFound('Profile');

  const favoriteRows = profile.favorites.length
    ? await db.all(`${THEORY_SUMMARY_SELECT} WHERE t.is_published = 1 AND t.slug IN (${profile.favorites.map(() => '?').join(',')})`, ...profile.favorites)
    : [];
  const order = new Map(profile.favorites.map((s, i) => [s, i]));
  const favorites = await translate(
    db,
    c.get('locale'),
    'theory',
    favoriteRows.map(mapTheorySummary).sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)),
    THEORY_FIELDS,
  );
  // Only published submissions that were sent under the author's name; anonymous ones never link back.
  const submissionRows = await db.all(
    `SELECT s.id, s.title, s.status, s.created_at, t.slug AS theory_slug FROM community_submissions s
     JOIN theories t ON t.id = s.published_theory_id AND t.is_published = 1
     WHERE s.user_id = ? AND s.status = 'published' AND s.display_mode = 'named' ORDER BY s.created_at DESC LIMIT 50`,
    row.id,
  );
  const result: PublicProfile = {
    username: String(row.username),
    displayName: String(row.display_name),
    createdAt: String(row.created_at),
    isOwner,
    isAdmin: await isAdminUser(db, Number(row.id)),
    avatar: imageInfo(row.avatar_id),
    banner: imageInfo(row.banner_id),
    profile,
    favorites,
    submissions: submissionRows.map(mapProfileSubmission),
    stats: { publishedSubmissions: submissionRows.length, favorites: favorites.length },
  };
  c.header('Cache-Control', 'private, no-store');
  return c.json(result);
});
