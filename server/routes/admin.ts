import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../http';
import { readJson } from '../http';
import { Db, pageParams, paged, parseJsonArray, type Row } from '../db';
import { adminConfigured, computeFeatures, requireFeature, turnstileConfigured } from '../features';
import { ApiError, notFound, classifyDbError } from '../errors';
import { assertSameOrigin, rateLimit } from '../security';
import {
  checkCredentials,
  clearSessionCookie,
  createSession,
  destroySession,
  loadSession,
  requireSession,
  sessionCookie,
  type AdminSession,
} from '../auth';
import { adminUserIds, isOwnerUser, ownerUserIds, setAdminUser, setOwnerUser } from '../users';
import {
  CATEGORY_SLUGS,
  ENTITY_TYPES,
  EVIDENCE_RELATIONS,
  EVIDENCE_STATUSES,
  LOCALES,
  RELATION_KINDS,
  RELATION_VERIFICATIONS,
  SOURCE_TYPES,
  SUBMISSION_STATUSES,
  type SubmissionStatus,
} from '../../shared/constants';
import { sanitizeRichDoc, textToDoc } from '../../shared/richtext';
import { validateSubmission } from '../../shared/submission';
import { arr, int, isoDateOrYear, oneOf, optOneOf, optStr, reqStr, slugify, url, ValidationError } from '../../shared/validation';
import { THEORY_SUMMARY_SELECT, loadTheoryDetail, mapSource, mapTheorySummary } from '../repo';
import { IMPORT_BATCH, LAST_RUN_KEY, lastImportResult, runImport } from '../importer';
import { addEdge, addNode, deleteEdge, deleteNode, savePositions } from '../boards';
import { BACKUP_TABLES, toCsv } from '../backup';
import { IMAGE_LIMITS } from '../../shared/images';
import { mapCaseNote } from './community';
import type { AdminCaseNote } from '../../shared/types';
import { IMAGE_PATH_RE, assertImageQuota, imageInsertStatements, imageResponse, imageStorageLimitBytes, imageStorageUsed, mapImage, parseImages } from '../images';

export const adminRoutes = new Hono<AppEnv>();
type AdminCtx = Ctx & { session?: AdminSession };

const MAIN_BOARD = 'main';

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

adminRoutes.post('/login', async (c) => {
  assertSameOrigin(c.req.raw);
  requireFeature(c.env, 'admin_panel');
  const db = Db.from(c.env);
  // 5 attempts per 15 minutes per (hashed) client.
  await rateLimit(db, c.env, c.req.raw, 'login', 5, 900);
  const body = await readJson(c, 2_000);
  const username = typeof body.username === 'string' ? body.username.slice(0, 100) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (!(await checkCredentials(c.env, username, password))) {
    throw new ApiError(401, 'invalid_credentials', 'Invalid username or password');
  }
  const { token, csrfToken } = await createSession(db);
  c.header('Set-Cookie', sessionCookie(token));
  return c.json({ authenticated: true, csrfToken, username });
});

adminRoutes.get('/session', async (c) => {
  const features = computeFeatures(c.env);
  if (!features.admin_panel.available) {
    return c.json({ authenticated: false, available: false, state: features.admin_panel.state, message: features.admin_panel.message });
  }
  const session = await loadSession(Db.from(c.env), c.env, c.req.raw);
  return c.json(
    session
      ? { authenticated: true, available: true, csrfToken: session.csrfToken, username: session.username, viaAccount: !!session.viaAccount,
          canManageOwners: !session.viaAccount || (!!session.userId && (await isOwnerUser(Db.from(c.env), session.userId))) }
      : { authenticated: false, available: true },
  );
});

adminRoutes.post('/logout', async (c) => {
  assertSameOrigin(c.req.raw);
  if (adminConfigured(c.env) && c.env.DB) {
    const db = Db.from(c.env);
    const session = await loadSession(db, c.env, c.req.raw);
    if (session) await destroySession(db, session);
  }
  c.header('Set-Cookie', clearSessionCookie());
  return c.json({ ok: true });
});

// Every other admin route: feature enabled (fail closed), valid session, CSRF for writes.
adminRoutes.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path.endsWith('/admin/login') || path.endsWith('/admin/session') || path.endsWith('/admin/logout')) return next();
  requireFeature(c.env, 'admin_panel');
  if (c.req.method !== 'GET') assertSameOrigin(c.req.raw);
  (c as AdminCtx).session = await requireSession(Db.from(c.env), c.env, c.req.raw);
  await next();
});

const actor = (c: Ctx) => (c as AdminCtx).session?.username ?? 'admin';
const idParam = (c: Ctx, name = 'id') => int(c.req.param(name), name, { min: 1 }) as number;

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

function mapSubmission(r: Row) {
  return {
    id: Number(r.id),
    title: String(r.title),
    subtitle: (r.subtitle as string) ?? null,
    summary: String(r.summary),
    body: JSON.parse(String(r.body_json)),
    category: r.category,
    tags: parseJsonArray<string>(r.tags_json),
    sources: parseJsonArray(r.sources_json),
    documentLinks: parseJsonArray<string>(r.document_links_json),
    counterArguments: parseJsonArray<string>(r.counter_arguments_json),
    relatedEvents: parseJsonArray<string>(r.related_events_json),
    relatedTheoryIds: parseJsonArray<number>(r.related_theory_ids_json),
    language: r.language,
    displayMode: r.display_mode,
    authorName: (r.author_name as string) ?? 'Anonymous',
    status: r.status as SubmissionStatus,
    moderatorNote: (r.moderator_note as string) ?? null,
    publishedTheorySlug: (r.published_slug as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

const SUBMISSION_SELECT = `
  SELECT s.*, c.slug AS category, a.display_name AS author_name, t.slug AS published_slug
  FROM community_submissions s
  JOIN categories c ON c.id = s.category_id
  LEFT JOIN authors a ON a.id = s.author_id
  LEFT JOIN theories t ON t.id = s.published_theory_id`;

adminRoutes.get('/overview', async (c) => {
  const db = Db.from(c.env);
  const rows = await db.all('SELECT status, COUNT(*) AS n FROM community_submissions GROUP BY status');
  const reports = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'");
  // Until migration 0006 is applied the table is missing; the overview must keep working.
  const notes = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM case_notes WHERE status = 'pending'").catch(() => null);
  return c.json({
    submissions: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])),
    openReports: Number(reports?.n ?? 0),
    pendingNotes: Number(notes?.n ?? 0),
  });
});

adminRoutes.get('/submissions', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const status = optOneOf(q.status, 'status', SUBMISSION_STATUSES) ?? 'pending_review';
  const rows = await db.all(`${SUBMISSION_SELECT} WHERE s.status = ? ORDER BY s.created_at DESC LIMIT ? OFFSET ?`, status, limit, offset);
  return c.json(paged(rows.map(mapSubmission), page, pageSize));
});

adminRoutes.get('/submissions/:id', async (c) => {
  const db = Db.from(c.env);
  const row = await db.first(`${SUBMISSION_SELECT} WHERE s.id = ?`, idParam(c));
  if (!row) throw notFound('Submission');
  const history = await db.all('SELECT action, note, actor, created_at FROM moderation_actions WHERE submission_id = ? ORDER BY created_at, id', row.id);
  const images = await db.all('SELECT public_id, mime, width, height, size, alt FROM images WHERE submission_id = ? ORDER BY position', row.id);
  return c.json({ ...mapSubmission(row), history, images: images.map((r) => mapImage(r, '/api/admin/images')) });
});

/** Moderators can view images of submissions that are not public yet. */
const MAX_IMAGE_BODY_BYTES = IMAGE_LIMITS.perSubmission * Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3 + 1000) + 10_000;

adminRoutes.get('/images/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{24}$/.test(id)) throw notFound('Image');
  const row = await Db.from(c.env).first('SELECT mime, data FROM images WHERE public_id = ?', id);
  if (!row) throw notFound('Image');
  return imageResponse(row, 'private');
});

/** Editorial images for a case file: compressed in the browser, public at once, counted against the budget. */
adminRoutes.post('/theories/:id/images', async (c) => {
  const db = Db.from(c.env);
  const theoryId = Number(c.req.param('id'));
  const body = await readJson(c, MAX_IMAGE_BODY_BYTES);
  const images = parseImages(body.images);
  if (images.length === 0) throw new ValidationError('images', 'no images');
  const theory = await db.first<{ id: number }>('SELECT id FROM theories WHERE id = ?', theoryId);
  if (!theory) throw notFound('Theory');
  await assertImageQuota(db, c.env, images.reduce((n, i) => n + i.bytes.length, 0));
  const pos = await db.first<{ next: number }>('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM images WHERE theory_id = ?', theoryId);
  await db.batch([
    ...(await imageInsertStatements(db, images, theoryId, Number(pos?.next ?? 0))),
    db.stmt("UPDATE theories SET updated_at = datetime('now') WHERE id = ?", theoryId),
  ]);
  const rows = await db.all("SELECT public_id, mime, width, height, size, alt FROM images WHERE theory_id = ? AND status = 'approved' ORDER BY position, id", theoryId);
  return c.json({ images: rows.map((r) => mapImage(r, '/api/images')) }, 201);
});

/** Deletes an image; a cover pointing at it falls back to the default card. */
adminRoutes.delete('/images/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{24}$/.test(id)) throw notFound('Image');
  const db = Db.from(c.env);
  const row = await db.first('SELECT id FROM images WHERE public_id = ?', id);
  if (!row) throw notFound('Image');
  const path = `/api/images/${id}`;
  await db.batch([
    db.stmt('DELETE FROM images WHERE public_id = ?', id),
    db.stmt('UPDATE theories SET image_path = NULL, image_credit = NULL WHERE image_path = ?', path),
    db.stmt('UPDATE board_nodes SET image_path = NULL WHERE image_path = ?', path),
  ]);
  return c.json({ ok: true });
});

/** Moderator edits content before publication. */
adminRoutes.patch('/submissions/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const existing = await db.first<{ display_mode: string; author_name: string }>(
    `SELECT s.display_mode, a.display_name AS author_name FROM community_submissions s LEFT JOIN authors a ON a.id = s.author_id WHERE s.id = ?`,
    id,
  );
  if (!existing) throw notFound('Submission');
  const body = await readJson(c);
  const input = validateSubmission({
    ...body,
    displayMode: existing.display_mode,
    displayName: existing.display_mode === 'named' ? existing.author_name : null,
  });
  const category = await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', input.category);
  await db.batch([
    db.stmt(
      `UPDATE community_submissions SET title = ?, subtitle = ?, summary = ?, body_json = ?, category_id = ?, tags_json = ?, sources_json = ?,
         document_links_json = ?, counter_arguments_json = ?, related_events_json = ?, related_theory_ids_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      input.title,
      input.subtitle,
      input.summary,
      JSON.stringify(input.body),
      category?.id,
      JSON.stringify(input.tags),
      JSON.stringify(input.sources),
      JSON.stringify(input.documentLinks),
      JSON.stringify(input.counterArguments),
      JSON.stringify(input.relatedEvents),
      JSON.stringify(input.relatedTheoryIds),
      id,
    ),
    db.stmt("INSERT INTO moderation_actions (submission_id, action, actor) VALUES (?, 'edit', ?)", id, actor(c)),
  ]);
  return c.json({ ok: true });
});

const TRANSITIONS: Record<string, { from: SubmissionStatus[]; to: SubmissionStatus }> = {
  approve: { from: ['pending_review', 'changes_requested'], to: 'approved' },
  reject: { from: ['pending_review', 'changes_requested', 'approved'], to: 'rejected' },
  request_changes: { from: ['pending_review', 'approved'], to: 'changes_requested' },
  publish: { from: ['approved'], to: 'published' },
  withdraw: { from: ['published', 'approved', 'pending_review'], to: 'withdrawn' },
};

adminRoutes.post('/submissions/:id/action', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const body = await readJson(c, 5_000);
  const action = oneOf(body.action, 'action', Object.keys(TRANSITIONS));
  const note = optStr(body.note, 'note', 2000);
  const row = await db.first(`${SUBMISSION_SELECT} WHERE s.id = ?`, id);
  if (!row) throw notFound('Submission');
  const t = TRANSITIONS[action];
  if (!t.from.includes(row.status as SubmissionStatus)) {
    throw new ApiError(409, 'invalid_transition', `Cannot ${action} a submission with status ${row.status}`);
  }

  let publishedSlug: string | null = null;
  if (action === 'publish') {
    publishedSlug = await publishSubmission(db, row);
  }
  if (action === 'reject' || action === 'withdraw') {
    // Rejected or withdrawn images are deleted to free the storage budget.
    await db.run('DELETE FROM images WHERE submission_id = ?', id);
  }
  if (action === 'withdraw' && row.published_theory_id) {
    await db.batch([
      db.stmt("UPDATE theories SET is_published = 0, updated_at = datetime('now') WHERE id = ?", row.published_theory_id),
      db.stmt("DELETE FROM board_nodes WHERE entity_type = 'theory' AND entity_id = ?", row.published_theory_id),
    ]);
  }
  await db.batch([
    db.stmt(
      "UPDATE community_submissions SET status = ?, moderator_note = COALESCE(?, moderator_note), updated_at = datetime('now') WHERE id = ?",
      t.to,
      note,
      id,
    ),
    db.stmt('INSERT INTO moderation_actions (submission_id, action, note, actor) VALUES (?, ?, ?, ?)', id, action, note, actor(c)),
  ]);
  return c.json({ ok: true, status: t.to, publishedSlug });
});

async function uniqueSlug(db: Db, table: 'theories' | 'events' | 'organizations', base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 2; i < 50; i++) {
    const exists = await db.first(`SELECT 1 AS x FROM ${table} WHERE slug = ?`, slug);
    if (!exists) return slug;
    slug = `${slugify(base)}-${i}`;
  }
  return `${slugify(base)}-${Date.now()}`;
}

/**
 * Turns an approved submission into a published archive entry.
 * - status is always "unverified" until an editor reviews claims and evidence
 * - sources are attached as general context only, never as proof of individual claims
 * - links to other theories become *suggested* connections
 */
async function publishSubmission(db: Db, row: Row): Promise<string> {
  const slug = await uniqueSlug(db, 'theories', String(row.title));
  const theory = await db.first<{ id: number }>(
    `INSERT INTO theories (slug, title, subtitle, summary, body_json, category_id, evidence_status, author_id, origin, content_language, is_published)
     VALUES (?, ?, ?, ?, ?, ?, 'unverified', ?, 'community', ?, 1) RETURNING id`,
    slug,
    row.title,
    row.subtitle ?? null,
    row.summary,
    row.body_json,
    row.category_id,
    row.author_id ?? null,
    row.language ?? 'en',
  );
  const theoryId = theory!.id;
  await db.run("UPDATE images SET status = 'approved', theory_id = ? WHERE submission_id = ?", theoryId, row.id);
  const stmts: D1PreparedStatement[] = [];

  for (const tag of parseJsonArray<string>(row.tags_json)) {
    const tagSlug = slugify(tag);
    stmts.push(db.stmt('INSERT INTO tags (slug, name) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING', tagSlug, tag));
    stmts.push(db.stmt('INSERT OR IGNORE INTO theory_tags (theory_id, tag_id) SELECT ?, id FROM tags WHERE slug = ?', theoryId, tagSlug));
  }
  parseJsonArray<string>(row.counter_arguments_json).forEach((text, i) => {
    stmts.push(db.stmt('INSERT INTO counter_arguments (theory_id, text, position) VALUES (?, ?, ?)', theoryId, text, i));
  });
  await db.batch(stmts);

  for (const s of parseJsonArray<{ title: string; url: string | null; publisher: string | null; sourceType: string }>(row.sources_json)) {
    const src = await db.first<{ id: number }>(
      `INSERT INTO sources (title, publisher, source_type, is_primary, url, notes) VALUES (?, ?, ?, 0, ?, 'Submitted by the community; not yet editorially verified.') RETURNING id`,
      s.title,
      s.publisher,
      (SOURCE_TYPES as readonly string[]).includes(s.sourceType) ? s.sourceType : 'other',
      s.url,
    );
    await db.run("INSERT INTO evidence (source_id, theory_id, relation, note) VALUES (?, ?, 'context', 'Community-provided source')", src!.id, theoryId);
  }
  for (const link of parseJsonArray<string>(row.document_links_json)) {
    const src = await db.first<{ id: number }>(
      `INSERT INTO sources (title, source_type, is_primary, url, notes) VALUES (?, 'other', 0, ?, 'Document link submitted by the community.') RETURNING id`,
      link.slice(0, 300),
      link,
    );
    await db.run("INSERT INTO evidence (source_id, theory_id, relation, note) VALUES (?, ?, 'context', 'Community-provided document link')", src!.id, theoryId);
  }

  const related = parseJsonArray<number>(row.related_theory_ids_json).filter((n) => Number.isInteger(n));
  const relStmts: D1PreparedStatement[] = [];
  for (const otherId of related.slice(0, 20)) {
    relStmts.push(
      db.stmt(
        `INSERT OR IGNORE INTO relationships (from_type, from_id, to_type, to_id, kind, verification, label)
         SELECT 'theory', ?, 'theory', id, 'claimed', 'suggested', 'Suggested by contributor' FROM theories WHERE id = ? AND is_published = 1`,
        theoryId,
        otherId,
      ),
    );
  }
  await db.batch(relStmts);

  // Pin the new entry onto the public investigation wall, next to its suggested connections.
  const board = await db.first<{ id: number }>('SELECT id FROM boards WHERE slug = ?', MAIN_BOARD);
  if (board) {
    const category = await db.first<{ slug: string }>('SELECT slug FROM categories WHERE id = ?', row.category_id);
    const anchor = related.length
      ? await db.first<{ x: number; y: number }>(
          `SELECT p.x, p.y FROM board_nodes n JOIN board_positions p ON p.node_id = n.id
           WHERE n.board_id = ? AND n.entity_type = 'theory' AND n.entity_id = ?`,
          board.id,
          related[0],
        )
      : null;
    const node = await addNode(db, board.id, {
      kind: 'theory',
      entityType: 'theory',
      entityId: theoryId,
      title: row.title,
      summary: String(row.summary).slice(0, 1000),
      category: category?.slug,
      evidenceStatus: 'unverified',
      tags: parseJsonArray<string>(row.tags_json).slice(0, 12),
      x: (anchor?.x ?? 0) + 260 + Math.round(Math.random() * 80),
      y: (anchor?.y ?? 0) + 140 + Math.round(Math.random() * 80),
    });
    for (const otherId of related.slice(0, 20)) {
      const other = await db.first<{ id: number }>(
        "SELECT id FROM board_nodes WHERE board_id = ? AND entity_type = 'theory' AND entity_id = ?",
        board.id,
        otherId,
      );
      if (other) {
        await db.run(
          `INSERT OR IGNORE INTO board_edges (board_id, source_node_id, target_node_id, kind, verification, label)
           VALUES (?, ?, ?, 'claimed', 'suggested', 'Suggested connection')`,
          board.id,
          node.id,
          other.id,
        );
      }
    }
  }
  await db.run('UPDATE community_submissions SET published_theory_id = ? WHERE id = ?', theoryId, row.id);
  return slug;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

adminRoutes.get('/reports', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const status = optOneOf(q.status, 'status', ['open', 'resolved', 'dismissed'] as const) ?? 'open';
  const rows = await db.all('SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', status, limit, offset);
  return c.json(paged(rows, page, pageSize));
});

adminRoutes.post('/reports/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const body = await readJson(c, 5_000);
  const status = oneOf(body.status, 'status', ['resolved', 'dismissed'] as const);
  const note = optStr(body.note, 'note', 2000);
  const r = await db.run("UPDATE reports SET status = ?, resolved_at = datetime('now') WHERE id = ?", status, id);
  if (!r.changes) throw notFound('Report');
  await db.run('INSERT INTO moderation_actions (report_id, action, note, actor) VALUES (?, ?, ?, ?)', id, `report_${status}`, note, actor(c));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Community notes on case files
// ---------------------------------------------------------------------------

adminRoutes.get('/notes', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const status = optOneOf(q.status, 'status', ['pending', 'approved', 'rejected'] as const) ?? 'pending';
  const rows = await db.all(
    `SELECT n.*, a.display_name AS author_name, t.slug AS theory_slug, t.title AS theory_title FROM case_notes n
     JOIN theories t ON t.id = n.theory_id LEFT JOIN authors a ON a.id = n.author_id
     WHERE n.status = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`,
    status,
    limit,
    offset,
  );
  const items: AdminCaseNote[] = rows.map((r) => ({
    ...mapCaseNote(r),
    status: r.status as AdminCaseNote['status'],
    moderatorNote: (r.moderator_note as string) ?? null,
    theory: { id: Number(r.theory_id), slug: String(r.theory_slug), title: String(r.theory_title) },
  }));
  return c.json(paged(items, page, pageSize));
});

adminRoutes.post('/notes/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const body = await readJson(c, 5_000);
  const status = oneOf(body.status, 'status', ['approved', 'rejected', 'pending'] as const);
  const note = optStr(body.note, 'note', 2000);
  const r = await db.run("UPDATE case_notes SET status = ?, moderator_note = ?, reviewed_at = datetime('now') WHERE id = ?", status, note, id);
  if (!r.changes) throw notFound('Note');
  await db.run('INSERT INTO moderation_actions (action, note, actor) VALUES (?, ?, ?)', `case_note_${status}:${id}`, note, actor(c));
  return c.json({ ok: true });
});

adminRoutes.delete('/notes/:id', async (c) => {
  const r = await Db.from(c.env).run('DELETE FROM case_notes WHERE id = ?', idParam(c));
  if (!r.changes) throw notFound('Note');
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Visitor accounts and profile images
// ---------------------------------------------------------------------------

adminRoutes.get('/users', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const search = optStr(q.q, 'q', 60);
  const rows = await db.all(
    `SELECT u.id, u.username, u.display_name, u.status, u.created_at,
            u.allow_animated,
            (SELECT COUNT(*) FROM community_submissions s WHERE s.user_id = u.id) AS submissions
     FROM users u WHERE (? IS NULL OR u.username LIKE ? OR u.display_name LIKE ?)
     ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    search,
    `%${search ?? ''}%`,
    `%${search ?? ''}%`,
    limit,
    offset,
  );
  const [admins, owners] = await Promise.all([adminUserIds(db).then((l) => new Set(l)), ownerUserIds(db).then((l) => new Set(l))]);
  const items = rows.map((r) => ({
    id: Number(r.id),
    isAdmin: admins.has(Number(r.id)),
    isOwner: owners.has(Number(r.id)),
    username: String(r.username),
    displayName: String(r.display_name),
    status: r.status as 'active' | 'locked',
    createdAt: String(r.created_at),
    allowAnimated: Number(r.allow_animated) === 1,
    submissions: Number(r.submissions),
  }));
  return c.json(paged(items, page, pageSize));
});

/**
 * Owner accounts are protected: only the secret admin login or another owner may change an owner
 * account or hand out / take away the owner rank. Account admins can manage everyone else.
 */
async function guardOwner(c: Ctx, db: Db, targetId: number, changesOwnerRank: boolean) {
  const session = (c as AdminCtx).session;
  if (!session?.viaAccount) return;
  if (session.userId && (await isOwnerUser(db, session.userId))) return;
  if (changesOwnerRank || (await isOwnerUser(db, targetId))) throw new ApiError(403, 'forbidden', 'Only the site owner can change owner accounts.');
}

/**
 * Locking hides the profile and its images and signs the account out everywhere; unlocking restores it.
 * allow_gif / disallow_gif switch animated GIF profile images on or off for one account.
 */
adminRoutes.post('/users/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const body = await readJson(c, 2_000);
  const action = oneOf(body.action, 'action', ['lock', 'unlock', 'allow_gif', 'disallow_gif', 'make_admin', 'remove_admin', 'make_owner', 'remove_owner'] as const);
  await guardOwner(c, db, id, action === 'make_owner' || action === 'remove_owner');
  const r =
    action === 'lock' || action === 'unlock'
      ? await db.run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", action === 'lock' ? 'locked' : 'active', id)
      : action === 'allow_gif' || action === 'disallow_gif'
        ? await db.run("UPDATE users SET allow_animated = ?, updated_at = datetime('now') WHERE id = ?", action === 'allow_gif' ? 1 : 0, id)
        : await db.run("UPDATE users SET updated_at = datetime('now') WHERE id = ?", id);
  if (r.changes && (action === 'make_admin' || action === 'remove_admin')) await setAdminUser(db, id, action === 'make_admin');
  if (r.changes && (action === 'make_owner' || action === 'remove_owner')) await setOwnerUser(db, id, action === 'make_owner');
  if (!r.changes) throw notFound('Account');
  if (action === 'lock') await db.run('DELETE FROM user_sessions WHERE user_id = ?', id);
  await db.run('INSERT INTO moderation_actions (action, note, actor) VALUES (?, ?, ?)', `user_${action}:${id}`, optStr(body.note, 'note', 2000), actor(c));
  return c.json({ ok: true });
});

adminRoutes.delete('/users/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  await guardOwner(c, db, id, false);
  // Profile images and sessions go with the account (ON DELETE CASCADE).
  const r = await db.run('DELETE FROM users WHERE id = ?', id);
  if (!r.changes) throw notFound('Account');
  await db.run('INSERT INTO moderation_actions (action, actor) VALUES (?, ?)', `user_delete:${id}`, actor(c));
  return c.json({ ok: true });
});

/** Newest profile pictures and banners. They are public at once; editors delete anything illegal afterwards. */
adminRoutes.get('/profile-images', async (c) => {
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q, 60, 40);
  const rows = await Db.from(c.env).all(
    `SELECT p.public_id, p.slot, p.mime, p.width, p.height, p.size, p.created_at, u.id AS user_id, u.username, u.display_name, u.status
     FROM profile_images p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  const items = rows.map((r) => ({
    id: String(r.public_id),
    url: `/api/admin/profile-images/${r.public_id}`,
    slot: r.slot === 'banner' ? 'banner' : 'avatar',
    mime: String(r.mime),
    width: Number(r.width),
    height: Number(r.height),
    size: Number(r.size),
    userId: Number(r.user_id),
    username: String(r.username),
    displayName: String(r.display_name),
    userStatus: String(r.status),
    createdAt: String(r.created_at),
  }));
  return c.json(paged(items, page, pageSize));
});

/** Editors see every profile image, also those of locked accounts. */
adminRoutes.get('/profile-images/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{24}$/.test(id)) throw notFound('Image');
  const row = await Db.from(c.env).first('SELECT mime, data FROM profile_images WHERE public_id = ?', id);
  if (!row) throw notFound('Image');
  return imageResponse(row, 'private');
});

adminRoutes.delete('/profile-images/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f]{24}$/.test(id)) throw notFound('Image');
  const db = Db.from(c.env);
  const row = await db.first<{ user_id: number }>('SELECT user_id FROM profile_images WHERE public_id = ?', id);
  if (!row) throw notFound('Image');
  await db.run('DELETE FROM profile_images WHERE public_id = ?', id);
  await db.run('INSERT INTO moderation_actions (action, actor) VALUES (?, ?)', `profile_image_delete:${row.user_id}`, actor(c));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Archive management
// ---------------------------------------------------------------------------

adminRoutes.get('/theories', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const params: unknown[] = [];
  let where = '1 = 1';
  if (q.q) {
    where = 't.title LIKE ?';
    params.push(`%${q.q.slice(0, 100)}%`);
  }
  const rows = await db.all(`${THEORY_SUMMARY_SELECT} WHERE ${where} ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  return c.json(paged(rows.map((r) => ({ ...mapTheorySummary(r) })), page, pageSize));
});

adminRoutes.get('/theories/:slug', async (c) => {
  const db = Db.from(c.env);
  const detail = await loadTheoryDetail(db, c.req.param('slug'), 'en', true);
  if (!detail) throw notFound('Theory');
  const pub = await db.first<{ is_published: number }>('SELECT is_published FROM theories WHERE id = ?', detail.id);
  return c.json({ ...detail, isPublished: pub?.is_published === 1 });
});

function parseTheory(body: Record<string, unknown>) {
  const imagePath = optStr(body.imagePath, 'imagePath', 300);
  if (imagePath && !IMAGE_PATH_RE.test(imagePath)) {
    throw new ValidationError('imagePath', 'must be a local asset path like /media/... or an uploaded image');
  }
  return {
    title: reqStr(body.title, 'title', 200, 2),
    subtitle: optStr(body.subtitle, 'subtitle', 300),
    summary: reqStr(body.summary, 'summary', 2000, 10),
    background: optStr(body.background, 'background', 20000),
    originStory: optStr(body.originStory, 'originStory', 20000),
    body: body.body ? sanitizeRichDoc(body.body) : typeof body.bodyText === 'string' && body.bodyText.trim() ? textToDoc(body.bodyText) : null,
    category: oneOf(body.category, 'category', CATEGORY_SLUGS),
    evidenceStatus: oneOf(body.evidenceStatus, 'evidenceStatus', EVIDENCE_STATUSES),
    imagePath,
    imageCredit: optStr(body.imageCredit, 'imageCredit', 500),
    tags: arr(body.tags, 'tags', 20, (t, i) => reqStr(t, `tags[${i}]`, 40)),
    isPublished: body.isPublished === undefined ? true : body.isPublished === true,
  };
}

async function setTags(db: Db, theoryId: number, tags: string[]) {
  const stmts: D1PreparedStatement[] = [db.stmt('DELETE FROM theory_tags WHERE theory_id = ?', theoryId)];
  for (const tag of tags) {
    stmts.push(db.stmt('INSERT INTO tags (slug, name) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING', slugify(tag), tag));
    stmts.push(db.stmt('INSERT OR IGNORE INTO theory_tags (theory_id, tag_id) SELECT ?, id FROM tags WHERE slug = ?', theoryId, slugify(tag)));
  }
  await db.batch(stmts);
}

adminRoutes.post('/theories', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c);
  const t = parseTheory(body);
  const slug = body.slug ? slugify(reqStr(body.slug, 'slug', 80)) : await uniqueSlug(db, 'theories', t.title);
  const category = await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', t.category);
  const row = await db.first<{ id: number }>(
    `INSERT INTO theories (slug, title, subtitle, summary, background, origin_story, body_json, category_id, evidence_status, image_path, image_credit, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    slug,
    t.title,
    t.subtitle,
    t.summary,
    t.background,
    t.originStory,
    t.body ? JSON.stringify(t.body) : null,
    category!.id,
    t.evidenceStatus,
    t.imagePath,
    t.imageCredit,
    t.isPublished ? 1 : 0,
  );
  await setTags(db, row!.id, t.tags);
  if (body.addToWall !== false && t.isPublished) {
    const board = await db.first<{ id: number }>('SELECT id FROM boards WHERE slug = ?', MAIN_BOARD);
    if (board) {
      await addNode(db, board.id, {
        kind: 'theory',
        entityType: 'theory',
        entityId: row!.id,
        title: t.title,
        summary: t.summary.slice(0, 1000),
        category: t.category,
        evidenceStatus: t.evidenceStatus,
        tags: t.tags.slice(0, 12),
        x: Math.round(Math.random() * 600 - 300),
        y: Math.round(Math.random() * 400 - 200),
      });
    }
  }
  return c.json({ id: row!.id, slug }, 201);
});

adminRoutes.put('/theories/:id', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const t = parseTheory(await readJson(c));
  const category = await db.first<{ id: number }>('SELECT id FROM categories WHERE slug = ?', t.category);
  const r = await db.run(
    `UPDATE theories SET title = ?, subtitle = ?, summary = ?, background = ?, origin_story = ?, body_json = ?, category_id = ?,
       evidence_status = ?, image_path = ?, image_credit = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?`,
    t.title,
    t.subtitle,
    t.summary,
    t.background,
    t.originStory,
    t.body ? JSON.stringify(t.body) : null,
    category!.id,
    t.evidenceStatus,
    t.imagePath,
    t.imageCredit,
    t.isPublished ? 1 : 0,
    id,
  );
  if (!r.changes) throw notFound('Theory');
  await setTags(db, id, t.tags);
  // Keep wall cards in sync with the archive entry.
  await db.run(
    "UPDATE board_nodes SET title = ?, summary = ?, category_slug = ?, evidence_status = ?, image_path = ?, tags_json = ? WHERE entity_type = 'theory' AND entity_id = ?",
    t.title,
    t.summary.slice(0, 1000),
    t.category,
    t.evidenceStatus,
    t.imagePath,
    JSON.stringify(t.tags.slice(0, 12)),
    id,
  );
  return c.json({ ok: true });
});

adminRoutes.post('/theories/:id/claims', async (c) => {
  const db = Db.from(c.env);
  const id = idParam(c);
  const body = await readJson(c, 10_000);
  const row = await db.first<{ id: number }>(
    'INSERT INTO claims (theory_id, text, evidence_status, position) VALUES (?, ?, ?, ?) RETURNING id',
    id,
    reqStr(body.text, 'text', 4000),
    oneOf(body.evidenceStatus, 'evidenceStatus', EVIDENCE_STATUSES),
    int(body.position ?? 0, 'position', { min: 0, max: 10000 }),
  );
  return c.json({ id: row?.id }, 201);
});

adminRoutes.patch('/claims/:id', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 10_000);
  const r = await db.run(
    'UPDATE claims SET text = ?, evidence_status = ? WHERE id = ?',
    reqStr(body.text, 'text', 4000),
    oneOf(body.evidenceStatus, 'evidenceStatus', EVIDENCE_STATUSES),
    idParam(c),
  );
  if (!r.changes) throw notFound('Claim');
  return c.json({ ok: true });
});

adminRoutes.delete('/claims/:id', async (c) => {
  const db = Db.from(c.env);
  const r = await db.run('DELETE FROM claims WHERE id = ?', idParam(c));
  if (!r.changes) throw notFound('Claim');
  return c.json({ ok: true });
});

adminRoutes.post('/theories/:id/counter-arguments', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 10_000);
  const row = await db.first<{ id: number }>(
    'INSERT INTO counter_arguments (theory_id, claim_id, text) VALUES (?, ?, ?) RETURNING id',
    idParam(c),
    int(body.claimId, 'claimId', { min: 1, optional: true }),
    reqStr(body.text, 'text', 4000),
  );
  return c.json({ id: row?.id }, 201);
});

adminRoutes.delete('/counter-arguments/:id', async (c) => {
  const db = Db.from(c.env);
  const r = await db.run('DELETE FROM counter_arguments WHERE id = ?', idParam(c));
  if (!r.changes) throw notFound('Counter argument');
  return c.json({ ok: true });
});

function parseSource(body: Record<string, unknown>) {
  return {
    title: reqStr(body.title, 'title', 400),
    publisher: optStr(body.publisher, 'publisher', 300),
    author: optStr(body.author, 'author', 300),
    publishedDate: isoDateOrYear(body.publishedDate, 'publishedDate'),
    sourceType: oneOf(body.sourceType, 'sourceType', SOURCE_TYPES),
    isPrimary: body.isPrimary === true,
    url: url(body.url, 'url'),
    lastChecked: isoDateOrYear(body.lastChecked, 'lastChecked'),
    qualityNote: optStr(body.qualityNote, 'qualityNote', 2000),
    notes: optStr(body.notes, 'notes', 2000),
  };
}

adminRoutes.get('/sources', async (c) => {
  const db = Db.from(c.env);
  const { page, pageSize, offset, limit } = pageParams(c.req.query(), 100, 50);
  const rows = await db.all('SELECT * FROM sources ORDER BY id DESC LIMIT ? OFFSET ?', limit, offset);
  return c.json(paged(rows.map((r) => mapSource(r)), page, pageSize));
});

adminRoutes.post('/sources', async (c) => {
  const db = Db.from(c.env);
  const s = parseSource(await readJson(c, 20_000));
  const row = await db.first<{ id: number }>(
    `INSERT INTO sources (title, publisher, author, published_date, source_type, is_primary, url, last_checked, quality_note, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    s.title,
    s.publisher,
    s.author,
    s.publishedDate,
    s.sourceType,
    s.isPrimary ? 1 : 0,
    s.url,
    s.lastChecked,
    s.qualityNote,
    s.notes,
  );
  return c.json({ id: row?.id }, 201);
});

adminRoutes.put('/sources/:id', async (c) => {
  const db = Db.from(c.env);
  const s = parseSource(await readJson(c, 20_000));
  const r = await db.run(
    `UPDATE sources SET title = ?, publisher = ?, author = ?, published_date = ?, source_type = ?, is_primary = ?, url = ?,
       last_checked = ?, quality_note = ?, notes = ? WHERE id = ?`,
    s.title,
    s.publisher,
    s.author,
    s.publishedDate,
    s.sourceType,
    s.isPrimary ? 1 : 0,
    s.url,
    s.lastChecked,
    s.qualityNote,
    s.notes,
    idParam(c),
  );
  if (!r.changes) throw notFound('Source');
  return c.json({ ok: true });
});

/** Attaches a source to one specific claim, counter-argument, or (as context) to the theory. */
adminRoutes.post('/evidence', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 5_000);
  const theoryId = int(body.theoryId, 'theoryId', { min: 1 }) as number;
  const claimId = int(body.claimId, 'claimId', { min: 1, optional: true });
  const counterId = int(body.counterArgumentId, 'counterArgumentId', { min: 1, optional: true });
  if (claimId && counterId) throw new ValidationError('claimId', 'link either a claim or a counter-argument, not both');
  if (claimId && !(await db.first('SELECT 1 AS x FROM claims WHERE id = ? AND theory_id = ?', claimId, theoryId))) {
    throw new ValidationError('claimId', 'claim does not belong to this theory');
  }
  if (counterId && !(await db.first('SELECT 1 AS x FROM counter_arguments WHERE id = ? AND theory_id = ?', counterId, theoryId))) {
    throw new ValidationError('counterArgumentId', 'counter-argument does not belong to this theory');
  }
  const row = await db.first<{ id: number }>(
    'INSERT INTO evidence (source_id, theory_id, claim_id, counter_argument_id, relation, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    int(body.sourceId, 'sourceId', { min: 1 }),
    theoryId,
    claimId,
    counterId,
    oneOf(body.relation, 'relation', EVIDENCE_RELATIONS),
    optStr(body.note, 'note', 2000),
  );
  return c.json({ id: row?.id }, 201);
});

adminRoutes.delete('/evidence/:id', async (c) => {
  const db = Db.from(c.env);
  const r = await db.run('DELETE FROM evidence WHERE id = ?', idParam(c));
  if (!r.changes) throw notFound('Evidence');
  return c.json({ ok: true });
});

adminRoutes.post('/relationships', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 5_000);
  const row = await db.first<{ id: number }>(
    `INSERT INTO relationships (from_type, from_id, to_type, to_id, kind, verification, label, note, source_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    oneOf(body.fromType, 'fromType', ENTITY_TYPES),
    int(body.fromId, 'fromId', { min: 1 }),
    oneOf(body.toType, 'toType', ENTITY_TYPES),
    int(body.toId, 'toId', { min: 1 }),
    oneOf(body.kind, 'kind', RELATION_KINDS),
    oneOf(body.verification ?? 'suggested', 'verification', RELATION_VERIFICATIONS),
    optStr(body.label, 'label', 200),
    optStr(body.note, 'note', 2000),
    int(body.sourceId, 'sourceId', { min: 1, optional: true }),
  );
  return c.json({ id: row?.id }, 201);
});

adminRoutes.delete('/relationships/:id', async (c) => {
  const db = Db.from(c.env);
  const r = await db.run('DELETE FROM relationships WHERE id = ?', idParam(c));
  if (!r.changes) throw notFound('Relationship');
  return c.json({ ok: true });
});

adminRoutes.put('/translations', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 50_000);
  const locale = oneOf(body.locale, 'locale', LOCALES);
  if (locale === 'en') throw new ValidationError('locale', 'English is stored in the main tables');
  await db.run(
    `INSERT INTO translations (entity_type, entity_id, locale, field, value) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (entity_type, entity_id, locale, field) DO UPDATE SET value = excluded.value`,
    oneOf(body.entityType, 'entityType', ['theory', 'event', 'organization', 'person', 'claim', 'counter_argument'] as const),
    int(body.entityId, 'entityId', { min: 1 }),
    locale,
    oneOf(body.field, 'field', ['title', 'subtitle', 'summary', 'background', 'origin_story', 'text', 'description', 'name', 'role'] as const),
    reqStr(body.value, 'value', 20000),
  );
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Public investigation wall editing
// ---------------------------------------------------------------------------

async function boardId(db: Db, slug: string): Promise<number> {
  const b = await db.first<{ id: number }>("SELECT id FROM boards WHERE slug = ? AND visibility = 'public'", slug);
  if (!b) throw notFound('Board');
  return b.id;
}

adminRoutes.post('/boards/:slug/nodes', async (c) => {
  const db = Db.from(c.env);
  return c.json(await addNode(db, await boardId(db, c.req.param('slug')), await readJson(c, 10_000)), 201);
});

adminRoutes.delete('/boards/:slug/nodes/:nodeId', async (c) => {
  const db = Db.from(c.env);
  await deleteNode(db, await boardId(db, c.req.param('slug')), idParam(c, 'nodeId'));
  return c.json({ ok: true });
});

adminRoutes.put('/boards/:slug/positions', async (c) => {
  const db = Db.from(c.env);
  return c.json(await savePositions(db, await boardId(db, c.req.param('slug')), await readJson(c)));
});

adminRoutes.post('/boards/:slug/edges', async (c) => {
  const db = Db.from(c.env);
  const body = await readJson(c, 5_000);
  const verification = oneOf(body.verification ?? 'suggested', 'verification', RELATION_VERIFICATIONS);
  return c.json(await addEdge(db, await boardId(db, c.req.param('slug')), body, verification), 201);
});

adminRoutes.delete('/boards/:slug/edges/:edgeId', async (c) => {
  const db = Db.from(c.env);
  await deleteEdge(db, await boardId(db, c.req.param('slug')), idParam(c, 'edgeId'));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Services, free-plan limits and usage
// ---------------------------------------------------------------------------

/** Free-tier limits as documented by Cloudflare at project start. Re-check before deploying. */
export const FREE_LIMITS = {
  pages: 'Static requests: unlimited · 500 builds/month · 20,000 files per deployment · 25 MiB per file',
  workers: '100,000 requests/day (shared by Pages Functions) · 10 ms CPU per request',
  d1: '5 million rows read/day · 100,000 rows written/day · 5 GB total storage (500 MB per database)',
  turnstile: 'Free plan: unlimited challenges for up to 20 widgets',
  images: 'Stored in D1: max. 512 KB per image, total capped by IMAGE_STORAGE_LIMIT_MB (default 250 MB of the 500 MB free database)',
  r2: 'Not used. Intentionally disabled (no bucket, no binding).',
};

adminRoutes.get('/services', async (c) => {
  const features = computeFeatures(c.env);
  let dbTest: { state: string; latencyMs: number | null; error: string | null } = { state: 'not_configured', latencyMs: null, error: null };
  let lastOk: string | null = null;
  let tableCounts: Record<string, number> | null = null;
  let imageUsage: { used: number; limit: number } | null = null;
  let lastImport: Awaited<ReturnType<typeof lastImportResult>> = null;
  if (c.env.DB) {
    const started = Date.now();
    try {
      await c.env.DB.prepare('SELECT 1').first();
      dbTest = { state: 'available', latencyMs: Date.now() - started, error: null };
      const db = Db.from(c.env);
      lastOk = new Date().toISOString();
      await db.run(
        "INSERT INTO settings (key, value) VALUES ('last_db_ok', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        lastOk,
      );
      imageUsage = { used: await imageStorageUsed(db), limit: imageStorageLimitBytes(c.env) };
      lastImport = await lastImportResult(db);
      if (c.req.query('counts') === '1') {
        tableCounts = {};
        for (const table of ['theories', 'sources', 'events', 'board_nodes', 'board_edges', 'community_submissions', 'investigations', 'images']) {
          const r = await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
          tableCounts[table] = Number(r?.n ?? 0);
        }
      }
    } catch (err) {
      dbTest = { state: classifyDbError(err), latencyMs: null, error: 'Database test failed' };
      try {
        const r = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'last_db_ok'").first<{ value: string }>();
        lastOk = r?.value ?? null;
      } catch {
        lastOk = null;
      }
    }
  }
  return c.json({
    plan: 'free-only',
    usageNote:
      'Live usage figures are not available inside the application. Cloudflare does not expose them to Pages Functions without an extra API token, and no paid monitoring is used. Check the Cloudflare dashboard for actual usage.',
    services: [
      { service: 'Cloudflare Pages', enabled: true, state: 'available', test: 'Serving this page', lastOk: null, freeLimit: FREE_LIMITS.pages, usage: 'Currently unavailable!' },
      { service: 'Cloudflare Workers (Pages Functions)', enabled: true, state: 'available', test: 'This request was handled', lastOk: new Date().toISOString(), freeLimit: FREE_LIMITS.workers, usage: 'Currently unavailable!' },
      { service: 'Cloudflare D1', enabled: !!c.env.DB, state: dbTest.state, test: dbTest.latencyMs !== null ? `SELECT 1 ok (${dbTest.latencyMs} ms)` : dbTest.error ?? 'Not configured', lastOk, freeLimit: FREE_LIMITS.d1, usage: 'Currently unavailable!', tableCounts },
      { service: 'Cloudflare Turnstile', enabled: turnstileConfigured(c.env), state: features.turnstile.state, test: turnstileConfigured(c.env) ? 'Configured (verified on each submission)' : 'Not configured', lastOk: null, freeLimit: FREE_LIMITS.turnstile, usage: 'Currently unavailable!' },
      {
        service: 'Image storage (D1)',
        enabled: features.community_uploads.available,
        state: features.community_uploads.state,
        test: imageUsage ? `${(imageUsage.used / 1048576).toFixed(1)} MB of ${(imageUsage.limit / 1048576).toFixed(0)} MB used` : 'Currently unavailable!',
        lastOk: null,
        freeLimit: FREE_LIMITS.images,
        usage: imageUsage ? `${Math.round((imageUsage.used / imageUsage.limit) * 100)} %` : 'Currently unavailable!',
      },
      {
        service: 'Automatic import (Wikidata / Wikipedia)',
        enabled: features.automatic_import.available,
        state: features.automatic_import.state,
        test: lastImport
          ? lastImport.error
            ? `Last run failed: ${lastImport.error}`
            : `${lastImport.imported.length} imported, ${lastImport.remaining} still to import`
          : 'No run yet',
        lastOk: lastImport && !lastImport.error ? lastImport.ranAt : null,
        freeLimit: `Free public APIs, max. ${IMPORT_BATCH} entries per run`,
        usage: 'Not applicable',
      },
      { service: 'Cloudflare R2', enabled: false, state: 'disabled', test: 'No binding exists', lastOk: null, freeLimit: FREE_LIMITS.r2, usage: 'Not applicable' },
    ],
    features,
  });
});

/** Runs the import immediately, without waiting for the schedule. */
adminRoutes.post('/import/run', async (c) => {
  requireFeature(c.env, 'automatic_import');
  const db = Db.from(c.env);
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    LAST_RUN_KEY,
    new Date().toISOString(),
  );
  return c.json(await runImport(db, undefined, imageStorageLimitBytes(c.env)));
});

// ---------------------------------------------------------------------------
// Backups: JSON / CSV export (download). Restore is done locally via scripts/restore.mjs.
// ---------------------------------------------------------------------------

adminRoutes.get('/export', async (c) => {
  const db = Db.from(c.env);
  const format = c.req.query('format') === 'csv' ? 'csv' : 'json';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'csv') {
    const table = oneOf(c.req.query('table'), 'table', BACKUP_TABLES);
    const rows = await db.all(`SELECT * FROM ${table} LIMIT 100000`);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="conspiracy-atlas-${table}-${stamp}.csv"`);
    return c.body(toCsv(rows));
  }
  const data: Record<string, Row[]> = {};
  for (const table of BACKUP_TABLES) data[table] = await db.all(`SELECT * FROM ${table} LIMIT 100000`);
  c.header('Content-Disposition', `attachment; filename="conspiracy-atlas-backup-${stamp}.json"`);
  return c.json({ format: 'conspiracy-atlas-backup', version: 1, createdAt: new Date().toISOString(), tables: data });
});
