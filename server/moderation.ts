// Reports and moderation of community content: what a report points at, and hiding / restoring it.
import type { Db, Row } from './db';
import type { Env } from './env';
import { sha256Hex } from './crypto';
import { clientIp } from './security';
import { REPORT_AUTO_HIDE_THRESHOLD, type ReportTargetType } from '../shared/constants';
import type { ReportTarget } from '../shared/types';

/** True once migration 0010 (reporter hash, new target types) is applied. Older databases keep the legacy behaviour. */
export async function moderationSchemaReady(db: Db): Promise<boolean> {
  try {
    await db.d1.prepare('SELECT reporter_hash FROM reports LIMIT 0').all();
    return true;
  } catch {
    return false;
  }
}

/**
 * Salted hash of the reporter, scoped to one target. It only lets one visitor count once per item;
 * it cannot be linked across items and never contains the IP address itself.
 */
export function reporterHash(env: Env, req: Request, type: ReportTargetType, id: number): Promise<string> {
  return sha256Hex(`${env.SESSION_SECRET || 'local-dev-salt'}|report|${type}:${id}|${clientIp(req)}`);
}

const MISSING: ReportTarget = { exists: false, title: '', excerpt: null, url: null, community: false, hideable: false, hidden: false, user: null };

const excerpt = (v: unknown, max = 280): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const userOf = (r: Row): ReportTarget['user'] =>
  r.user_id != null && r.username != null ? { id: Number(r.user_id), username: String(r.username), locked: r.user_status === 'locked' } : null;

/** Looks up a reported item. Never throws for a missing item or a table that does not exist yet. */
export async function describeTarget(db: Db, type: string, id: number): Promise<ReportTarget> {
  try {
    switch (type) {
      case 'theory': {
        const r = await db.first(
          `SELECT t.slug, t.title, t.summary, t.origin, t.is_published, s.user_id, u.username, u.status AS user_status
           FROM theories t
           LEFT JOIN community_submissions s ON s.published_theory_id = t.id
           LEFT JOIN users u ON u.id = s.user_id
           WHERE t.id = ? LIMIT 1`,
          id,
        );
        if (!r) return MISSING;
        const community = r.origin === 'community';
        return {
          exists: true,
          title: String(r.title),
          excerpt: excerpt(r.summary),
          url: `/theory/${r.slug}`,
          community,
          hideable: community,
          hidden: Number(r.is_published) !== 1,
          user: userOf(r),
        };
      }
      case 'case_note': {
        const r = await db.first(
          `SELECT n.body, n.status, t.slug, t.title FROM case_notes n JOIN theories t ON t.id = n.theory_id WHERE n.id = ?`,
          id,
        );
        if (!r) return MISSING;
        return { exists: true, title: String(r.title), excerpt: excerpt(r.body), url: `/theory/${r.slug}`, community: true, hideable: true, hidden: r.status !== 'approved', user: null };
      }
      case 'comment': {
        const r = await db.first(
          `SELECT c.body, c.status, c.user_id, u.username, u.status AS user_status, t.slug, t.title
           FROM comments c JOIN theories t ON t.id = c.theory_id LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
          id,
        );
        if (!r) return MISSING;
        return {
          exists: true,
          title: String(r.title),
          excerpt: excerpt(r.body),
          url: `/theory/${r.slug}`,
          community: true,
          hideable: r.status !== 'deleted',
          hidden: r.status !== 'visible',
          user: userOf(r),
        };
      }
      case 'profile': {
        const r = await db.first('SELECT id AS user_id, username, display_name, status AS user_status FROM users WHERE id = ?', id);
        if (!r) return MISSING;
        return {
          exists: true,
          title: String(r.display_name),
          excerpt: `@${r.username}`,
          url: `/u/${r.username}`,
          community: true,
          hideable: true,
          hidden: r.user_status === 'locked',
          user: userOf(r),
        };
      }
      case 'event': {
        const r = await db.first('SELECT slug, title FROM events WHERE id = ?', id);
        return r ? { ...MISSING, exists: true, title: String(r.title), url: `/events/${r.slug}` } : MISSING;
      }
      case 'organization': {
        const r = await db.first('SELECT slug, name FROM organizations WHERE id = ?', id);
        return r ? { ...MISSING, exists: true, title: String(r.name), url: `/organizations/${r.slug}` } : MISSING;
      }
      case 'source': {
        const r = await db.first('SELECT title, url FROM sources WHERE id = ?', id);
        return r ? { ...MISSING, exists: true, title: String(r.title), url: (r.url as string) ?? null } : MISSING;
      }
      case 'submission': {
        const r = await db.first('SELECT title, summary FROM community_submissions WHERE id = ?', id);
        return r ? { ...MISSING, exists: true, title: String(r.title), excerpt: excerpt(r.summary), community: true } : MISSING;
      }
      default:
        return MISSING;
    }
  } catch {
    // E.g. the comments table before its migration is applied.
    return MISSING;
  }
}

/**
 * Hides a reported item. Automatic hiding sends a case note back to the review queue; an editor's hide rejects it.
 * Profiles are hidden by locking the account (never automatically). Returns whether anything changed.
 */
export async function hideTarget(db: Db, type: string, id: number, mode: 'auto' | 'manual'): Promise<boolean> {
  switch (type) {
    case 'theory':
      return (await db.run("UPDATE theories SET is_published = 0, updated_at = datetime('now') WHERE id = ? AND origin = 'community' AND is_published = 1", id)).changes > 0;
    case 'case_note':
      return (
        await db.run(
          "UPDATE case_notes SET status = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'approved'",
          mode === 'auto' ? 'pending' : 'rejected',
          id,
        )
      ).changes > 0;
    case 'comment':
      return (await db.run("UPDATE comments SET status = 'hidden' WHERE id = ? AND status = 'visible'", id)).changes > 0;
    case 'profile': {
      if (mode === 'auto') return false;
      return lockUser(db, id);
    }
    default:
      return false;
  }
}

/** Makes a hidden item visible again. */
export async function restoreTarget(db: Db, type: string, id: number): Promise<boolean> {
  switch (type) {
    case 'theory':
      return (await db.run("UPDATE theories SET is_published = 1, updated_at = datetime('now') WHERE id = ? AND origin = 'community' AND is_published = 0", id)).changes > 0;
    case 'case_note':
      return (await db.run("UPDATE case_notes SET status = 'approved', reviewed_at = datetime('now') WHERE id = ? AND status != 'approved'", id)).changes > 0;
    case 'comment':
      return (await db.run("UPDATE comments SET status = 'visible' WHERE id = ? AND status = 'hidden'", id)).changes > 0;
    case 'profile':
      return (await db.run("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'locked'", id)).changes > 0;
    default:
      return false;
  }
}

/** Locks an account: hides the profile and its images and signs it out everywhere. */
export async function lockUser(db: Db, userId: number): Promise<boolean> {
  const r = await db.run("UPDATE users SET status = 'locked', updated_at = datetime('now') WHERE id = ? AND status = 'active'", userId);
  if (r.changes) await db.run('DELETE FROM user_sessions WHERE user_id = ?', userId);
  return r.changes > 0;
}

/** Hides community content once enough different visitors have reported it. Returns whether it was hidden now. */
export async function autoHideIfNeeded(db: Db, type: ReportTargetType, id: number, target: ReportTarget): Promise<boolean> {
  if (type === 'profile' || !target.community || !target.hideable || target.hidden) return false;
  const row = await db.first<{ n: number }>(
    "SELECT COUNT(DISTINCT reporter_hash) AS n FROM reports WHERE target_type = ? AND target_id = ? AND status = 'open' AND reporter_hash IS NOT NULL",
    type,
    id,
  );
  if (Number(row?.n ?? 0) < REPORT_AUTO_HIDE_THRESHOLD) return false;
  const hidden = await hideTarget(db, type, id, 'auto');
  if (hidden) {
    await db.run(
      'INSERT INTO moderation_actions (action, note, actor) VALUES (?, ?, ?)',
      `auto_hide:${type}:${id}`,
      `Hidden automatically after ${REPORT_AUTO_HIDE_THRESHOLD} reports`,
      'system',
    );
  }
  return hidden;
}
