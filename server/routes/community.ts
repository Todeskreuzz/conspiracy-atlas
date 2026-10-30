import { Hono } from 'hono';
import type { AppEnv } from '../http';
import { readJson } from '../http';
import { Db } from '../db';
import { requireFeature } from '../features';
import { rateLimit, verifyTurnstile, assertSameOrigin } from '../security';
import { validateSubmission } from '../../shared/submission';
import { ANONYMOUS_NAME, REPORT_REASONS } from '../../shared/constants';
import { int, oneOf, optStr } from '../../shared/validation';
import { ApiError } from '../errors';

export const communityRoutes = new Hono<AppEnv>();

/** Testing seam: Turnstile verification uses global fetch unless replaced. */
export const turnstileFetch: { impl: typeof fetch } = { impl: (...args) => fetch(...args) };

/** Uploads are intentionally not implemented: there is no object storage in the free-only architecture. */
communityRoutes.all('/uploads/*', (c) =>
  c.json(
    {
      error: {
        code: 'unavailable',
        state: 'disabled',
        message: 'Currently unavailable! File storage is intentionally disabled in the free-only configuration.',
      },
    },
    503,
  ),
);
communityRoutes.all('/uploads', (c) =>
  c.json(
    {
      error: {
        code: 'unavailable',
        state: 'disabled',
        message: 'Currently unavailable! File storage is intentionally disabled in the free-only configuration.',
      },
    },
    503,
  ),
);

/** New community submission. Always lands in the moderation queue (pending_review). */
communityRoutes.post('/submissions', async (c) => {
  assertSameOrigin(c.req.raw);
  requireFeature(c.env, 'community_submissions');
  const input = validateSubmission(await readJson(c));
  await verifyTurnstile(c.env, input.turnstileToken, turnstileFetch.impl);
  const db = Db.from(c.env);
  await rateLimit(db, c.env, c.req.raw, 'submission', 5, 3600);

  const category = await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', input.category);
  if (!category) throw new ApiError(400, 'invalid', 'Unknown category', undefined, 'category');

  // Only the chosen public name is stored; for anonymous submissions just "Anonymous".
  const isAnon = input.displayMode === 'anonymous';
  const author = await db.first<{ id: number }>(
    'INSERT INTO authors (display_name, is_anonymous) VALUES (?, ?) RETURNING id',
    isAnon ? ANONYMOUS_NAME : input.displayName,
    isAnon ? 1 : 0,
  );
  const row = await db.first<{ id: number; created_at: string }>(
    `INSERT INTO community_submissions
       (title, subtitle, summary, body_json, category_id, tags_json, sources_json, document_links_json, counter_arguments_json,
        related_events_json, related_theory_ids_json, language, author_id, display_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review') RETURNING id, created_at`,
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
  );
  return c.json({ id: row?.id, status: 'pending_review', authorName: isAnon ? ANONYMOUS_NAME : input.displayName }, 201);
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
