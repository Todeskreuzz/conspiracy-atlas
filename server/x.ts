// Owner-only X drafts. Ranking and the case of the day are the same as the Reddit queue;
// which cases have been posted is stored separately, so one network does not hide the other.
import type { Db, Row } from './db';
import { ApiError, notFound } from './errors';
import { caseOfTheDayTheoryId } from './reddit';
import type { CategorySlug, EvidenceStatus } from '../shared/constants';
import { REDDIT_ENGAGED_POOL, REDDIT_RECENT_POOL, rankRedditCases } from '../shared/reddit';
import {
  X_DRAFTS_PER_DAY,
  buildXDraft,
  resolveXHandle,
  type XDraft,
} from '../shared/x';

const X_TABLES = ['x_posts', 'x_daily_posts'] as const;

export async function assertXTables(db: Db): Promise<void> {
  const found = await db.all<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${X_TABLES.map(() => '?').join(', ')})`,
    ...X_TABLES,
  );
  const have = new Set(found.map((r) => r.name));
  const missing = X_TABLES.filter((name) => !have.has(name));
  if (missing.length) {
    throw new ApiError(503, 'migration_required', `Missing table ${missing.join(', ')}. From an up-to-date checkout run: npm run db:migrate:remote`);
  }
}

const CANDIDATE_SQL = `
  SELECT t.id, t.slug, t.title, t.summary, t.image_path, t.evidence_status, t.updated_at, t.content_language, c.slug AS category,
         (SELECT COUNT(*) FROM claims cl WHERE cl.theory_id = t.id) AS claim_count,
         (SELECT COUNT(*) FROM counter_arguments ca WHERE ca.theory_id = t.id) AS counter_count,
         (SELECT COUNT(*) FROM comments cm WHERE cm.theory_id = t.id AND cm.status = 'visible') AS comment_count,
         (SELECT COUNT(*) FROM theory_votes v WHERE v.theory_id = t.id) AS vote_count,
         (SELECT COUNT(*) FROM relationships r WHERE r.from_type = 'theory' AND r.from_id = t.id)
           + (SELECT COUNT(*) FROM relationships r WHERE r.to_type = 'theory' AND r.to_id = t.id) AS connection_count
  FROM theories t
  JOIN categories c ON c.id = t.category_id
  WHERE t.is_published = 1
    AND NOT EXISTS (SELECT 1 FROM x_posts p WHERE p.theory_id = t.id)`;

interface Candidate {
  id: number;
  slug: string;
  title: string;
  imagePath: string | null;
  summary: string;
  category: CategorySlug;
  evidenceStatus: EvidenceStatus;
  updatedAt: string;
  contentLanguage: string;
  claimCount: number;
  counterCount: number;
  connectionCount: number;
  commentCount: number;
  voteCount: number;
  counterArgument: string | null;
  sourceTitles: string[];
}

function mapCandidate(r: Row): Candidate {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    imagePath: (r.image_path as string) ?? null,
    summary: String(r.summary),
    category: r.category as CategorySlug,
    evidenceStatus: r.evidence_status as EvidenceStatus,
    updatedAt: String(r.updated_at),
    contentLanguage: String(r.content_language ?? 'en'),
    claimCount: Number(r.claim_count ?? 0),
    counterCount: Number(r.counter_count ?? 0),
    connectionCount: Number(r.connection_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
    voteCount: Number(r.vote_count ?? 0),
    counterArgument: null,
    sourceTitles: [],
  };
}

async function pool(db: Db): Promise<Candidate[]> {
  const [recent, engaged] = await Promise.all([
    db.all(`${CANDIDATE_SQL} ORDER BY t.updated_at DESC, t.id DESC LIMIT ?`, REDDIT_RECENT_POOL),
    db.all(`${CANDIDATE_SQL} ORDER BY comment_count DESC, vote_count DESC, t.updated_at DESC, t.id DESC LIMIT ?`, REDDIT_ENGAGED_POOL),
  ]);
  const byId = new Map<number, Candidate>();
  for (const row of [...recent, ...engaged]) {
    const c = mapCandidate(row);
    byId.set(c.id, c);
  }
  return [...byId.values()];
}

async function loadOne(db: Db, theoryId: number): Promise<Candidate | null> {
  const row = await db.first(
    `SELECT t.id, t.slug, t.title, t.summary, t.image_path, t.evidence_status, t.updated_at, t.content_language, c.slug AS category,
            0 AS claim_count, 0 AS counter_count, 0 AS connection_count, 0 AS comment_count, 0 AS vote_count
     FROM theories t JOIN categories c ON c.id = t.category_id
     WHERE t.id = ? AND t.is_published = 1`,
    theoryId,
  );
  return row ? mapCandidate(row) : null;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

async function attachNotes(db: Db, cases: Candidate[]): Promise<void> {
  if (!cases.length) return;
  const ids = cases.map((c) => c.id);
  const inList = placeholders(ids.length);
  const [counters, sources, english] = await Promise.all([
    db.all<{ theory_id: number; text: string }>(
      `SELECT theory_id, text FROM counter_arguments WHERE theory_id IN (${inList}) ORDER BY theory_id, position, id`,
      ...ids,
    ),
    db.all<{ theory_id: number; title: string }>(
      `SELECT e.theory_id, s.title FROM evidence e JOIN sources s ON s.id = e.source_id
       WHERE e.theory_id IN (${inList}) ORDER BY s.is_primary DESC, s.id`,
      ...ids,
    ),
    db.all<{ entity_id: number; field: string; value: string }>(
      `SELECT entity_id, field, value FROM translations
       WHERE entity_type = 'theory' AND locale = 'en' AND field IN ('title', 'summary')
         AND entity_id IN (${inList})`,
      ...ids,
    ),
  ]);
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const c of counters) {
    const host = byId.get(Number(c.theory_id));
    if (host && !host.counterArgument) host.counterArgument = String(c.text);
  }
  for (const s of sources) {
    const host = byId.get(Number(s.theory_id));
    if (!host || host.sourceTitles.includes(String(s.title)) || host.sourceTitles.length >= 2) continue;
    host.sourceTitles.push(String(s.title));
  }
  const tr = new Map<number, Record<string, string>>();
  for (const row of english) {
    const m = tr.get(Number(row.entity_id)) ?? {};
    m[String(row.field)] = String(row.value);
    tr.set(Number(row.entity_id), m);
  }
  for (const c of cases) {
    if (c.contentLanguage === 'en') continue;
    const t = tr.get(c.id);
    if (!t) continue;
    if (t.title) c.title = t.title;
    if (t.summary) c.summary = t.summary;
  }
}

export interface XPosted {
  theoryId: number;
  slug: string;
  title: string;
  postedAt: string;
  actor: string;
}

export interface XQueue {
  handle: string;
  handleInvalid: boolean;
  perDay: number;
  drafts: XDraft[];
  caseOfTheDay: { day: string; posted: boolean; draft: XDraft } | null;
  posted: XPosted[];
}

function toDraft(c: Candidate, origin: string, day: string, score: number, daily: boolean): XDraft {
  return buildXDraft(
    {
      id: c.id,
      slug: c.slug,
      title: c.title,
      imagePath: c.imagePath,
      summary: c.summary,
      category: c.category,
      evidenceStatus: c.evidenceStatus,
      counterArgument: c.counterArgument,
      sourceTitles: c.sourceTitles,
      score,
    },
    { origin, day, daily },
  );
}

export async function loadXQueue(db: Db, origin: string, handleRaw: string | undefined, now = new Date()): Promise<XQueue> {
  await assertXTables(db);
  const handle = resolveXHandle(handleRaw);
  const day = now.toISOString().slice(0, 10);
  const dailyPick = await caseOfTheDayTheoryId(db, now);
  const ranked = rankRedditCases(
    (await pool(db)).filter((c) => c.id !== dailyPick?.theoryId),
    now,
  ).slice(0, X_DRAFTS_PER_DAY);
  const daily = dailyPick ? await loadOne(db, dailyPick.theoryId) : null;
  await attachNotes(db, daily ? [...ranked, daily] : ranked);
  const dailyRow = dailyPick
    ? await db.first<{ theory_id: number }>('SELECT theory_id FROM x_daily_posts WHERE day = ?', dailyPick.day)
    : null;
  const posted = (
    await db.all(
      `SELECT p.theory_id, p.posted_at, p.actor, t.slug, t.title
       FROM x_posts p JOIN theories t ON t.id = p.theory_id
       ORDER BY p.posted_at DESC, p.theory_id DESC LIMIT 8`,
    )
  ).map((r) => ({
    theoryId: Number(r.theory_id),
    slug: String(r.slug),
    title: String(r.title),
    postedAt: String(r.posted_at),
    actor: String(r.actor),
  }));
  return {
    handle: handle.handle,
    handleInvalid: handle.invalid,
    perDay: X_DRAFTS_PER_DAY,
    drafts: ranked.map((c) => toDraft(c, origin, day, c.score.total, false)),
    caseOfTheDay:
      dailyPick && daily
        ? {
            day: dailyPick.day,
            posted: Number(dailyRow?.theory_id) === dailyPick.theoryId,
            draft: toDraft(daily, origin, day, 0, true),
          }
        : null,
    posted,
  };
}

export async function setXPosted(db: Db, theoryId: number, actor: string, posted: boolean): Promise<void> {
  await assertXTables(db);
  if (!posted) {
    await db.run('DELETE FROM x_posts WHERE theory_id = ?', theoryId);
    return;
  }
  const row = await db.first<{ id: number; is_published: number }>('SELECT id, is_published FROM theories WHERE id = ?', theoryId);
  if (!row || Number(row.is_published) !== 1) throw notFound('Case');
  await db.run(
    `INSERT INTO x_posts (theory_id, actor) VALUES (?, ?)
     ON CONFLICT(theory_id) DO UPDATE SET posted_at = datetime('now'), actor = excluded.actor`,
    theoryId,
    actor.slice(0, 80),
  );
}

export async function setXDailyPosted(db: Db, actor: string, posted: boolean, now = new Date()): Promise<void> {
  await assertXTables(db);
  const pick = await caseOfTheDayTheoryId(db, now);
  if (!pick) throw notFound('Case');
  if (!posted) {
    await db.run('DELETE FROM x_daily_posts WHERE day = ? AND theory_id = ?', pick.day, pick.theoryId);
    return;
  }
  await db.run(
    `INSERT INTO x_daily_posts (day, theory_id, actor) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET theory_id = excluded.theory_id, posted_at = datetime('now'), actor = excluded.actor`,
    pick.day,
    pick.theoryId,
    actor.slice(0, 80),
  );
}
