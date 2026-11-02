// Loads owner-only Reddit drafts from published cases. Text is built in shared/reddit.ts.
import type { AdminSession } from './auth';
import type { Db, Row } from './db';
import { ApiError, forbidden, notFound, unauthorized } from './errors';
import { isOwnerUser } from './users';
import type { CategorySlug, EvidenceStatus } from '../shared/constants';
import {
  REDDIT_DRAFTS_PER_DAY,
  REDDIT_ENGAGED_POOL,
  REDDIT_RECENT_POOL,
  buildRedditDraft,
  rankRedditCases,
  resolveSubreddit,
  type RedditCase,
  type RedditDraft,
  type RedditPosted,
} from '../shared/reddit';

/** Secret admin login, or a visitor account with the owner ("Grand Master") rank. Ordinary admins are refused. */
export async function requireSiteOwner(db: Db, session: AdminSession | undefined): Promise<AdminSession> {
  if (!session) throw unauthorized();
  if (!session.viaAccount) return session;
  if (session.userId && (await isOwnerUser(db, session.userId))) return session;
  throw forbidden('Only the site owner can use Reddit drafts.');
}

const CANDIDATE_SELECT = `
  SELECT t.id, t.slug, t.title, t.subtitle, t.summary, t.evidence_status, t.updated_at, t.content_language,
         c.slug AS category,
         (SELECT COUNT(*) FROM claims cl WHERE cl.theory_id = t.id) AS claim_count,
         (SELECT COUNT(*) FROM counter_arguments ca WHERE ca.theory_id = t.id) AS counter_count,
         (SELECT COUNT(*) FROM comments cm WHERE cm.theory_id = t.id AND cm.status = 'visible') AS comment_count,
         (SELECT COUNT(*) FROM theory_votes v WHERE v.theory_id = t.id) AS vote_count,
         (SELECT COUNT(*) FROM relationships r WHERE r.from_type = 'theory' AND r.from_id = t.id)
           + (SELECT COUNT(*) FROM relationships r WHERE r.to_type = 'theory' AND r.to_id = t.id) AS connection_count,
         (SELECT COUNT(DISTINCT e.source_id) FROM evidence e WHERE e.theory_id = t.id) AS source_count
  FROM theories t
  JOIN categories c ON c.id = t.category_id
  WHERE t.is_published = 1
    AND NOT EXISTS (SELECT 1 FROM reddit_posts p WHERE p.theory_id = t.id)`;

interface Candidate extends RedditCase {
  contentLanguage: string;
}

function mapCandidate(r: Row): Candidate {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    subtitle: (r.subtitle as string) ?? null,
    summary: String(r.summary),
    category: r.category as CategorySlug,
    evidenceStatus: r.evidence_status as EvidenceStatus,
    updatedAt: String(r.updated_at),
    claims: [],
    counterArguments: [],
    sourceTitles: [],
    claimCount: Number(r.claim_count ?? 0),
    counterCount: Number(r.counter_count ?? 0),
    connectionCount: Number(r.connection_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
    voteCount: Number(r.vote_count ?? 0),
    sourceCount: Number(r.source_count ?? 0),
    contentLanguage: String(r.content_language ?? 'en'),
  };
}

async function candidatePool(db: Db): Promise<Candidate[]> {
  const [recent, engaged] = await Promise.all([
    db.all(`${CANDIDATE_SELECT} ORDER BY t.updated_at DESC, t.id DESC LIMIT ?`, REDDIT_RECENT_POOL),
    db.all(`${CANDIDATE_SELECT} ORDER BY comment_count DESC, vote_count DESC, t.updated_at DESC, t.id DESC LIMIT ?`, REDDIT_ENGAGED_POOL),
  ]);
  const byId = new Map<number, Candidate>();
  for (const row of [...recent, ...engaged]) {
    const c = mapCandidate(row);
    byId.set(c.id, c);
  }
  return [...byId.values()];
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

async function attachDetails(db: Db, cases: Candidate[]): Promise<void> {
  if (!cases.length) return;
  const ids = cases.map((c) => c.id);
  const inList = placeholders(ids.length);
  const [claims, counters, sources] = await Promise.all([
    db.all<{ id: number; theory_id: number; text: string; evidence_status: string }>(
      `SELECT id, theory_id, text, evidence_status FROM claims WHERE theory_id IN (${inList}) ORDER BY theory_id, position, id`,
      ...ids,
    ),
    db.all<{ theory_id: number; text: string }>(
      `SELECT theory_id, text FROM counter_arguments WHERE theory_id IN (${inList}) ORDER BY theory_id, position, id`,
      ...ids,
    ),
    db.all<{ theory_id: number; title: string; is_primary: number }>(
      `SELECT e.theory_id, s.title, s.is_primary FROM evidence e JOIN sources s ON s.id = e.source_id
       WHERE e.theory_id IN (${inList}) ORDER BY s.is_primary DESC, s.id`,
      ...ids,
    ),
  ]);
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const c of claims) {
    const host = byId.get(Number(c.theory_id));
    if (!host) continue;
    host.claims.push({ id: Number(c.id), text: String(c.text), evidenceStatus: c.evidence_status as EvidenceStatus });
  }
  for (const c of counters) byId.get(Number(c.theory_id))?.counterArguments.push(String(c.text));
  for (const s of sources) {
    const host = byId.get(Number(s.theory_id));
    if (!host || host.sourceTitles.includes(String(s.title))) continue;
    host.sourceTitles.push(String(s.title));
  }
}

/** Prefer an English translation when the stored file is not English. Base columns are already English for the archive. */
async function overlayEnglish(db: Db, cases: Candidate[]): Promise<void> {
  const foreign = cases.filter((c) => c.contentLanguage !== 'en');
  if (!foreign.length) return;
  const ids = foreign.map((c) => c.id);
  const fields = await db.all<{ entity_id: number; field: string; value: string }>(
    `SELECT entity_id, field, value FROM translations
     WHERE entity_type = 'theory' AND locale = 'en' AND field IN ('title', 'subtitle', 'summary')
       AND entity_id IN (${placeholders(ids.length)})`,
    ...ids,
  );
  const byTheory = new Map<number, Record<string, string>>();
  for (const f of fields) {
    const m = byTheory.get(Number(f.entity_id)) ?? {};
    m[String(f.field)] = String(f.value);
    byTheory.set(Number(f.entity_id), m);
  }
  for (const c of foreign) {
    const t = byTheory.get(c.id);
    if (!t) continue;
    if (t.title) c.title = t.title;
    if (t.subtitle) c.subtitle = t.subtitle;
    if (t.summary) c.summary = t.summary;
  }
  const claimIds = foreign.flatMap((c) => c.claims.map((claim) => claim.id)).filter((id) => id > 0);
  if (!claimIds.length) return;
  const claimText = await db.all<{ entity_id: number; value: string }>(
    `SELECT entity_id, value FROM translations
     WHERE entity_type = 'claim' AND locale = 'en' AND field = 'text' AND entity_id IN (${placeholders(claimIds.length)})`,
    ...claimIds,
  );
  const text = new Map(claimText.map((r) => [Number(r.entity_id), String(r.value)]));
  for (const c of foreign) {
    c.claims = c.claims.map((claim) => ({ ...claim, text: text.get(claim.id) ?? claim.text }));
  }
}

export interface RedditQueue {
  subreddit: string;
  subredditInvalid: boolean;
  perDay: number;
  drafts: RedditDraft[];
  posted: RedditPosted[];
}

/** A missing table is a pending migration, not an unconfigured database. */
export async function assertRedditPostsTable(db: Db): Promise<void> {
  const row = await db.first<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reddit_posts'");
  if (!row) {
    throw new ApiError(
      503,
      'migration_required',
      'The reddit_posts table is missing. From an up-to-date checkout run: npm run db:migrate:remote',
    );
  }
}

export async function loadRedditQueue(db: Db, origin: string, subredditRaw: string | undefined, now = new Date()): Promise<RedditQueue> {
  await assertRedditPostsTable(db);
  const subreddit = resolveSubreddit(subredditRaw);
  const pool = await candidatePool(db);
  const ranked = rankRedditCases(pool, now).slice(0, REDDIT_DRAFTS_PER_DAY);
  await attachDetails(db, ranked);
  await overlayEnglish(db, ranked);
  const drafts = ranked.map((c) => buildRedditDraft(c, { origin, subreddit: subreddit.name, now }));
  const posted = (
    await db.all(
      `SELECT p.theory_id, p.posted_at, p.actor, t.slug, t.title
       FROM reddit_posts p JOIN theories t ON t.id = p.theory_id
       ORDER BY p.posted_at DESC, p.theory_id DESC LIMIT 8`,
    )
  ).map((r) => ({
    theoryId: Number(r.theory_id),
    slug: String(r.slug),
    title: String(r.title),
    postedAt: String(r.posted_at),
    actor: String(r.actor),
  }));
  return { subreddit: subreddit.name, subredditInvalid: subreddit.invalid, perDay: REDDIT_DRAFTS_PER_DAY, drafts, posted };
}

export async function setRedditPosted(db: Db, theoryId: number, actor: string, posted: boolean): Promise<void> {
  await assertRedditPostsTable(db);
  if (!posted) {
    await db.run('DELETE FROM reddit_posts WHERE theory_id = ?', theoryId);
    return;
  }
  const row = await db.first<{ id: number; is_published: number }>('SELECT id, is_published FROM theories WHERE id = ?', theoryId);
  if (!row || Number(row.is_published) !== 1) throw notFound('Case');
  await db.run(
    `INSERT INTO reddit_posts (theory_id, actor) VALUES (?, ?)
     ON CONFLICT(theory_id) DO UPDATE SET posted_at = datetime('now'), actor = excluded.actor`,
    theoryId,
    actor.slice(0, 80),
  );
}
