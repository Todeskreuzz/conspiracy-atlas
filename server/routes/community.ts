import { Hono } from 'hono';
import type { AppEnv } from '../http';
import { readJson } from '../http';
import { Db } from '../db';
import { requireFeature } from '../features';
import { rateLimit, verifyTurnstile, assertSameOrigin } from '../security';
import { validateSubmission } from '../../shared/submission';
import { ANONYMOUS_NAME, REPORT_REASONS } from '../../shared/constants';
import { int, oneOf, optStr, reqStr, url } from '../../shared/validation';
import type { Row } from '../db';
import type { CaseNote } from '../../shared/types';
import { ApiError, notFound } from '../errors';
import { assertImageQuota, imageInsertStatements, imageResponse, parseImages } from '../images';
import { IMAGE_LIMITS } from '../../shared/images';
import { loadUserSession } from '../users';

export const communityRoutes = new Hono<AppEnv>();

/** JSON body limit for submissions: text plus up to four base64-encoded images. */
const MAX_SUBMISSION_BYTES = 200_000 + IMAGE_LIMITS.perSubmission * Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3 + 1000);

/** Testing seam: Turnstile verification uses global fetch unless replaced. */
export const turnstileFetch: { impl: typeof fetch } = { impl: (...args) => fetch(...args) };

/** Approved community images (served from D1, cached by browsers for a year). */
communityRoutes.get('/images/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{24}$/.test(id)) throw notFound('Image');
  const db = Db.from(c.env);
  const row = await db.first("SELECT mime, data FROM images WHERE public_id = ? AND status = 'approved'", id);
  if (row) return imageResponse(row, 'public');
  // Profile pictures and banners (public at once, removable by editors).
  const profileImage = await db.first(
    "SELECT p.mime, p.data FROM profile_images p JOIN users u ON u.id = p.user_id AND u.status = 'active' WHERE p.public_id = ?",
    id,
  );
  if (!profileImage) throw notFound('Image');
  return imageResponse(profileImage, 'short');
});

/** New community submission. Always lands in the moderation queue (pending_review). */
communityRoutes.post('/submissions', async (c) => {
  assertSameOrigin(c.req.raw);
  requireFeature(c.env, 'community_submissions');
  const raw = await readJson(c, MAX_SUBMISSION_BYTES);
  const input = validateSubmission(raw);
  const images = parseImages(raw.images);
  if (images.length) requireFeature(c.env, 'community_uploads');
  await verifyTurnstile(c.env, input.turnstileToken, turnstileFetch.impl);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'submission', 5, 3600);
  await assertImageQuota(db, c.env, images.reduce((n, img) => n + img.bytes.length, 0));

  const category = await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', input.category);
  if (!category) throw new ApiError(400, 'invalid', 'Unknown category', undefined, 'category');

  // Signed-in authors see the submission in their account; it appears on their profile only if named and published.
  const session = await loadUserSession(db, c.req.raw);
  // Only the chosen public name is stored; for anonymous submissions just "Anonymous".
  const isAnon = input.displayMode === 'anonymous';
  const author = await db.first<{ id: number }>(
    'INSERT INTO authors (display_name, is_anonymous) VALUES (?, ?) RETURNING id',
    isAnon ? ANONYMOUS_NAME : input.displayName,
    isAnon ? 1 : 0,
  );
  // Submission and its images are written in one transaction.
  const results = await db.batch([
    db.stmt(
      `INSERT INTO community_submissions
         (title, subtitle, summary, body_json, category_id, tags_json, sources_json, document_links_json, counter_arguments_json,
          related_events_json, related_theory_ids_json, language, author_id, display_mode, user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')`,
      input.title,
      input.subtitle,
      input.summary,
      JSON.stringify(input.body),
      category.id,
      JSON.stringify(input.tags),
      JSON.stringify(input.sources),
      JSON.stringify(input.documentLinks),
      JSON.stringify(input.counterArguments),
      JSON.stringify(input.relatedEvents),
      JSON.stringify(input.relatedTheoryIds),
      input.language,
      author?.id ?? null,
      input.displayMode,
      session?.userId ?? null,
    ),
    ...(await imageInsertStatements(db, images)),
  ]);
  const row = { id: Number(results[0]?.meta?.last_row_id) };
  return c.json({ id: row.id, status: 'pending_review', authorName: isAnon ? ANONYMOUS_NAME : input.displayName, images: images.length }, 201);
});

/** Visitors can report content for moderation. */
communityRoutes.post('/reports', async (c) => {
  assertSameOrigin(c.req.raw);
  requireFeature(c.env, 'reports');
  const body = await readJson(c, 10_000);
  const targetType = oneOf(body.targetType, 'targetType', ['theory', 'submission', 'event', 'organization', 'source'] as const);
  const targetId = int(body.targetId, 'targetId', { min: 1 }) as number;
  const reason = oneOf(body.reason, 'reason', REPORT_REASONS);
  const details = optStr(body.details, 'details', 2000);
  await verifyTurnstile(c.env, typeof body.turnstileToken === 'string' ? body.turnstileToken : null, turnstileFetch.impl);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'report', 10, 3600);
  await db.run('INSERT INTO reports (target_type, target_id, reason, details) VALUES (?, ?, ?, ?)', targetType, targetId, reason, details);
  return c.json({ ok: true }, 201);
});

export const CASE_NOTE_KINDS = ['comment', 'source'] as const;

export function mapCaseNote(r: Row): CaseNote {
  return {
    id: Number(r.id),
    kind: r.kind as CaseNote['kind'],
    body: String(r.body),
    sourceUrl: (r.source_url as string) ?? null,
    sourceTitle: (r.source_title as string) ?? null,
    authorName: (r.author_name as string) ?? ANONYMOUS_NAME,
    language: r.language === 'de' ? 'de' : 'en',
    createdAt: String(r.created_at),
  };
}

/** Approved community notes of a case (newest first). */
communityRoutes.get('/theories/:slug/notes', async (c) => {
  const db = Db.from(c.env);
  const rows = await db.all(
    `SELECT n.*, a.display_name AS author_name FROM case_notes n
     JOIN theories t ON t.id = n.theory_id AND t.is_published = 1
     LEFT JOIN authors a ON a.id = n.author_id
     WHERE t.slug = ? AND n.status = 'approved' ORDER BY n.created_at DESC, n.id DESC LIMIT 200`,
    c.req.param('slug'),
  );
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({ items: rows.map(mapCaseNote) });
});

/** A visitor adds a comment or a source to a case. It is only shown after an editor approves it. */
communityRoutes.post('/theories/:slug/notes', async (c) => {
  assertSameOrigin(c.req.raw);
  requireFeature(c.env, 'community_submissions');
  const body = await readJson(c, 10_000);
  const kind = oneOf(body.kind, 'kind', CASE_NOTE_KINDS);
  const text = reqStr(body.body, 'body', 2000);
  if (text.trim().length < 10) throw new ApiError(400, 'invalid', 'Please write at least 10 characters', undefined, 'body');
  const sourceUrl = url(body.sourceUrl, 'sourceUrl', kind === 'comment');
  const sourceTitle = optStr(body.sourceTitle, 'sourceTitle', 300);
  const language = body.language === 'de' ? 'de' : 'en';
  const anonymous = body.displayMode !== 'named';
  const name = anonymous ? ANONYMOUS_NAME : reqStr(body.displayName, 'displayName', 60);
  await verifyTurnstile(c.env, typeof body.turnstileToken === 'string' ? body.turnstileToken : null, turnstileFetch.impl);
  const db = Db.from(c.env);
  const theory = await db.first<{ id: number }>('SELECT id FROM theories WHERE slug = ? AND is_published = 1', c.req.param('slug'));
  if (!theory) throw notFound('Theory');
  await rateLimit(db, c.env, c.req.raw, 'case_note', 5, 3600);
  const author = await db.first<{ id: number }>('INSERT INTO authors (display_name, is_anonymous) VALUES (?, ?) RETURNING id', name, anonymous ? 1 : 0);
  const note = await db.first<{ id: number }>(
    `INSERT INTO case_notes (theory_id, author_id, kind, body, source_url, source_title, language) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    theory.id,
    author?.id ?? null,
    kind,
    text.trim(),
    sourceUrl,
    sourceTitle,
    language,
  );
  return c.json({ id: note?.id, status: 'pending' }, 201);
});
