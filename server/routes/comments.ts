import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../http';
import { readJson } from '../http';
import { Db, type Row } from '../db';
import { requireFeature } from '../features';
import { ApiError, forbidden, notFound } from '../errors';
import { assertSameOrigin, rateLimit } from '../security';
import { loadUserSession, requireUser, type UserSession } from '../users';
import { int } from '../../shared/validation';
import { COMMENT_LIMITS, validateCommentBody, validateVote } from '../../shared/comments';
import type { CommentAuthor, Discussion, DiscussionComment, VoteTally, VoteValue } from '../../shared/types';

/**
 * Comments and votes under case files and community theories (both are rows in `theories`).
 * Reading is public; writing needs a signed-in account (sign-up is protected by Turnstile).
 * Comments appear at once; editors (and the report system) can hide them.
 */
export const commentRoutes = new Hono<AppEnv>();

function writeGuard(c: Ctx) {
  requireFeature(c.env, 'accounts');
  assertSameOrigin(c.req.raw);
}

function idParam(c: Ctx, name = 'id'): number {
  const id = Number(c.req.param(name));
  if (!Number.isInteger(id) || id < 1) throw notFound('Comment');
  return id;
}

async function publishedTheory(db: Db, slug: string): Promise<number> {
  const row = await db.first<{ id: number }>('SELECT id FROM theories WHERE slug = ? AND is_published = 1', slug);
  if (!row) throw notFound('Theory');
  return Number(row.id);
}

/** Per-account rate limit (the bucket carries the account id, the key the client IP). */
const limitUser = (db: Db, c: Ctx, user: UserSession, bucket: string, limit: number, windowSec: number) =>
  rateLimit(db, c.env, c.req.raw, `${bucket}:${user.userId}`, limit, windowSec);

export function mapAuthor(r: Row): CommentAuthor | null {
  if (!r.author_username) return null;
  return {
    username: String(r.author_username),
    displayName: String(r.author_display_name),
    avatarUrl: r.author_avatar_id ? `/api/images/${r.author_avatar_id}` : null,
  };
}

const myVote = (v: unknown): VoteValue => (v === 1 || v === -1 ? v : Number(v) === 1 ? 1 : Number(v) === -1 ? -1 : 0);

export async function theoryTally(db: Db, theoryId: number, userId: number | null): Promise<VoteTally> {
  const row = await db.first<{ up: number; down: number; mine: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0) AS up,
            COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0) AS down,
            MAX(CASE WHEN user_id = ? THEN value END) AS mine
     FROM theory_votes WHERE theory_id = ?`,
    userId ?? 0,
    theoryId,
  );
  return { up: Number(row?.up ?? 0), down: Number(row?.down ?? 0), myVote: myVote(row?.mine) };
}

async function commentTally(db: Db, commentId: number, userId: number): Promise<VoteTally> {
  const row = await db.first<{ up: number; down: number; mine: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END), 0) AS up,
            COALESCE(SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END), 0) AS down,
            MAX(CASE WHEN user_id = ? THEN value END) AS mine
     FROM comment_votes WHERE comment_id = ?`,
    userId,
    commentId,
  );
  return { up: Number(row?.up ?? 0), down: Number(row?.down ?? 0), myVote: myVote(row?.mine) };
}

/** Author columns shared by the public list and the admin list. Locked accounts are left out. */
export const COMMENT_AUTHOR_JOIN = `
  LEFT JOIN users u ON u.id = c.user_id AND u.status = 'active'
  LEFT JOIN profile_images av ON av.user_id = u.id AND av.slot = 'avatar'`;
export const COMMENT_AUTHOR_COLUMNS = 'u.username AS author_username, u.display_name AS author_display_name, av.public_id AS author_avatar_id';

const score = (v: VoteTally) => v.up - v.down;

/** Builds the threaded list: top-level comments (sorted) with their replies (oldest first). */
export function threadComments(rows: Row[], userId: number | null, sort: 'top' | 'new'): DiscussionComment[] {
  const all = new Map<number, DiscussionComment>();
  for (const r of rows) {
    const author = mapAuthor(r);
    const deleted = r.status === 'deleted';
    // A comment of a locked (or removed) account is dropped together with its replies.
    if (!author && !deleted) continue;
    all.set(Number(r.id), {
      id: Number(r.id),
      parentId: r.parent_id == null ? null : Number(r.parent_id),
      body: deleted ? '' : String(r.body),
      deleted,
      language: r.language === 'de' ? 'de' : 'en',
      createdAt: String(r.created_at),
      editedAt: (r.edited_at as string) ?? null,
      author: deleted ? null : author,
      votes: { up: Number(r.up ?? 0), down: Number(r.down ?? 0), myVote: myVote(r.my_vote) },
      mine: !deleted && userId !== null && Number(r.user_id) === userId,
      replies: [],
    });
  }
  const top: DiscussionComment[] = [];
  for (const cm of all.values()) {
    if (cm.parentId === null) top.push(cm);
    else all.get(cm.parentId)?.replies.push(cm);
  }
  const visible = top.filter((cm) => !cm.deleted || cm.replies.length > 0);
  for (const cm of visible) cm.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  visible.sort((a, b) =>
    sort === 'top'
      ? score(b.votes) - score(a.votes) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      : b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  );
  return visible;
}

/** Votes and comments of a case. Signed-in visitors also get their own votes. */
commentRoutes.get('/theories/:slug/discussion', async (c) => {
  requireFeature(c.env, 'accounts');
  const db = Db.from(c.env);
  const theoryId = await publishedTheory(db, c.req.param('slug'));
  const session = await loadUserSession(db, c.req.raw);
  const userId = session?.userId ?? null;
  const sort = c.req.query('sort') === 'new' ? 'new' : 'top';
  const rows = await db.all(
    `SELECT c.id, c.parent_id, c.user_id, c.body, c.language, c.status, c.created_at, c.edited_at, ${COMMENT_AUTHOR_COLUMNS},
            (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = 1) AS up,
            (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id = c.id AND v.value = -1) AS down,
            (SELECT v.value FROM comment_votes v WHERE v.comment_id = c.id AND v.user_id = ?) AS my_vote
     FROM comments c ${COMMENT_AUTHOR_JOIN}
     WHERE c.theory_id = ? AND c.status IN ('visible', 'deleted')
     ORDER BY c.created_at, c.id LIMIT ?`,
    userId ?? 0,
    theoryId,
    COMMENT_LIMITS.maxPerCase,
  );
  const comments = threadComments(rows, userId, sort);
  const total = comments.reduce((n, cm) => n + (cm.deleted ? 0 : 1) + cm.replies.filter((r) => !r.deleted).length, 0);
  const result: Discussion = { votes: await theoryTally(db, theoryId, userId), comments, total };
  c.header('Cache-Control', session ? 'private, no-store' : 'public, max-age=20');
  return c.json(result);
});

/** Vote on a case: 1, -1, or 0 to take the vote back. */
commentRoutes.put('/theories/:slug/vote', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const value = validateVote((await readJson(c, 1_000)).value);
  const theoryId = await publishedTheory(db, c.req.param('slug'));
  await limitUser(db, c, user, 'vote', COMMENT_LIMITS.votesPerHour, 3600);
  if (value === 0) await db.run('DELETE FROM theory_votes WHERE theory_id = ? AND user_id = ?', theoryId, user.userId);
  else
    await db.run(
      `INSERT INTO theory_votes (theory_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT (theory_id, user_id) DO UPDATE SET value = excluded.value, created_at = datetime('now')`,
      theoryId,
      user.userId,
      value,
    );
  return c.json(await theoryTally(db, theoryId, user.userId));
});

/** New comment or reply. Replies to a reply are attached to its top-level comment (one level). */
commentRoutes.post('/theories/:slug/comments', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const body = await readJson(c, 10_000);
  const text = validateCommentBody(body.body);
  const parentInput = int(body.parentId, 'parentId', { min: 1, optional: true });
  const language = body.language === 'de' ? 'de' : 'en';
  const theoryId = await publishedTheory(db, c.req.param('slug'));
  let parentId: number | null = null;
  if (parentInput) {
    const parent = await db.first<{ id: number; parent_id: number | null; status: string }>(
      'SELECT id, parent_id, status FROM comments WHERE id = ? AND theory_id = ?',
      parentInput,
      theoryId,
    );
    if (!parent || parent.status === 'hidden') throw new ApiError(400, 'invalid', 'The comment you are replying to does not exist', undefined, 'parentId');
    parentId = parent.parent_id ?? Number(parent.id);
  }
  await limitUser(db, c, user, 'comment', COMMENT_LIMITS.perWindow, COMMENT_LIMITS.windowSeconds);
  const row = await db.first<{ id: number; created_at: string }>(
    'INSERT INTO comments (theory_id, user_id, parent_id, body, language) VALUES (?, ?, ?, ?, ?) RETURNING id, created_at',
    theoryId,
    user.userId,
    parentId,
    text,
    language,
  );
  return c.json({ id: Number(row?.id), parentId, status: 'visible' }, 201);
});

async function ownComment(db: Db, id: number, user: UserSession) {
  const row = await db.first<{ id: number; user_id: number | null; status: string; parent_id: number | null }>(
    'SELECT id, user_id, status, parent_id FROM comments WHERE id = ?',
    id,
  );
  if (!row || row.status === 'deleted') throw notFound('Comment');
  if (Number(row.user_id) !== user.userId) throw forbidden('You can only change your own comments');
  return row;
}

/** The author edits the text (hidden comments stay hidden). */
commentRoutes.patch('/comments/:id', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const id = idParam(c);
  const text = validateCommentBody((await readJson(c, 10_000)).body);
  const row = await ownComment(db, id, user);
  if (row.status === 'hidden') throw forbidden('This comment was hidden by the moderators');
  await limitUser(db, c, user, 'comment_edit', 30, 600);
  await db.run("UPDATE comments SET body = ?, edited_at = datetime('now') WHERE id = ?", text, id);
  return c.json({ ok: true });
});

/** The author deletes a comment. With replies it stays as an empty placeholder. */
commentRoutes.delete('/comments/:id', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const id = idParam(c);
  await ownComment(db, id, user);
  const replies = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE parent_id = ? AND status != 'deleted'", id);
  if (Number(replies?.n ?? 0) > 0) {
    await db.batch([
      db.stmt("UPDATE comments SET status = 'deleted', body = '', edited_at = datetime('now') WHERE id = ?", id),
      db.stmt('DELETE FROM comment_votes WHERE comment_id = ?', id),
    ]);
  } else {
    await db.run('DELETE FROM comments WHERE id = ?', id);
  }
  return c.json({ ok: true });
});

/** Vote on somebody else's comment: 1, -1, or 0 to take the vote back. */
commentRoutes.put('/comments/:id/vote', async (c) => {
  writeGuard(c);
  const db = Db.from(c.env);
  const user = await requireUser(db, c.req.raw);
  const id = idParam(c);
  const value = validateVote((await readJson(c, 1_000)).value);
  const row = await db.first<{ user_id: number | null; status: string }>('SELECT user_id, status FROM comments WHERE id = ?', id);
  if (!row || row.status !== 'visible') throw notFound('Comment');
  if (Number(row.user_id) === user.userId) throw new ApiError(400, 'invalid', 'You cannot vote on your own comment', undefined, 'value');
  await limitUser(db, c, user, 'vote', COMMENT_LIMITS.votesPerHour, 3600);
  if (value === 0) await db.run('DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?', id, user.userId);
  else
    await db.run(
      `INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?)
       ON CONFLICT (comment_id, user_id) DO UPDATE SET value = excluded.value, created_at = datetime('now')`,
      id,
      user.userId,
      value,
    );
  return c.json(await commentTally(db, id, user.userId));
});
