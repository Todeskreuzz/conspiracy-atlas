import { Hono } from 'hono';
import type { AppEnv } from '../http';
import { publicCache } from '../http';
import { Db, pageParams, paged } from '../db';
import { computeFeatures, turnstileConfigured } from '../features';
import { notFound, classifyDbError } from '../errors';
import { EVIDENCE_STATUSES, CATEGORY_SLUGS } from '../../shared/constants';
import {
  EVENT_FIELDS,
  EVENT_SELECT,
  THEORY_FIELDS,
  THEORY_SUMMARY_SELECT,
  loadBoardContent,
  loadRelationships,
  loadTheoryDetail,
  mapDocument,
  mapEvent,
  mapLocation,
  mapOrganization,
  mapPerson,
  mapSource,
  mapTheorySummary,
  translate,
} from '../repo';

export const publicRoutes = new Hono<AppEnv>();

const likeEscape = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** Feature availability. Pure configuration check: no database reads. */
publicRoutes.get('/status', (c) => {
  publicCache(c, 30);
  const features = computeFeatures(c.env);
  return c.json({
    features,
    turnstileSiteKey: turnstileConfigured(c.env) ? c.env.TURNSTILE_SITE_KEY : null,
    plan: 'free-only',
  });
});

/** Connectivity check for the database (one trivial query). */
publicRoutes.get('/health', async (c) => {
  if (!c.env.DB) return c.json({ ok: false, database: 'not_configured' }, 503);
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ ok: true, database: 'available' });
  } catch (err) {
    const state = classifyDbError(err);
    return c.json({ ok: false, database: state }, state === 'limit_reached' ? 429 : 503);
  }
});

publicRoutes.get('/categories', async (c) => {
  const db = Db.from(c.env);
  const rows = await db.all(
    `SELECT c.id, c.slug, c.name, c.description,
            (SELECT COUNT(*) FROM theories t WHERE t.category_id = c.id AND t.is_published = 1) AS theory_count
     FROM categories c ORDER BY c.sort_order`,
  );
  publicCache(c, 300);
  return c.json({
    items: rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, theoryCount: Number(r.theory_count) })),
  });
});

publicRoutes.get('/theories', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const where: string[] = ['t.is_published = 1'];
  const params: unknown[] = [];
  if (q.category && (CATEGORY_SLUGS as readonly string[]).includes(q.category)) {
    where.push('c.slug = ?');
    params.push(q.category);
  }
  if (q.status && (EVIDENCE_STATUSES as readonly string[]).includes(q.status)) {
    where.push('t.evidence_status = ?');
    params.push(q.status);
  }
  if (q.origin === 'community' || q.origin === 'editorial') {
    where.push('t.origin = ?');
    params.push(q.origin);
  }
  if (q.tag) {
    where.push('EXISTS (SELECT 1 FROM theory_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.theory_id = t.id AND tg.slug = ?)');
    params.push(q.tag.slice(0, 80));
  }
  if (q.q && q.q.trim()) {
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.summary LIKE ? ESCAPE '\\')");
    const like = likeEscape(q.q.trim().slice(0, 100));
    params.push(like, like);
  }
  const order = q.sort === 'title' ? 't.title COLLATE NOCASE ASC' : 't.updated_at DESC';
  const rows = await db.all(`${THEORY_SUMMARY_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...params, limit, offset);
  const items = await translate(db, c.get('locale'), 'theory', rows.map(mapTheorySummary), THEORY_FIELDS);
  publicCache(c, 60);
  return c.json(paged(items, page, pageSize));
});

/** Stable pick per UTC day (FNV-1a over the date), so every visitor sees the same case all day. */
export function caseOfTheDayIndex(day: string, count: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
  return count > 0 ? (h >>> 0) % count : 0;
}

/** Case of the day: one published case per UTC day, the same for everyone. */
publicRoutes.get('/case-of-the-day', async (c) => {
  const db = Db.from(c.env);
  const day = new Date().toISOString().slice(0, 10);
  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM theories WHERE is_published = 1');
  const n = Number(count?.n ?? 0);
  if (!n) return c.json({ day, theory: null });
  const row = await db.first(`${THEORY_SUMMARY_SELECT} WHERE t.is_published = 1 ORDER BY t.id LIMIT 1 OFFSET ?`, caseOfTheDayIndex(day, n));
  const [theory] = row ? await translate(db, c.get('locale'), 'theory', [mapTheorySummary(row)], THEORY_FIELDS) : [null];
  publicCache(c, 300);
  return c.json({ day, theory });
});

/** A random published case (for the "random case file" button). Never cached. */
publicRoutes.get('/random-case', async (c) => {
  const db = Db.from(c.env);
  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM theories WHERE is_published = 1');
  const n = Number(count?.n ?? 0);
  if (!n) throw notFound('Theory');
  const row = await db.first<{ slug: string }>('SELECT slug FROM theories WHERE is_published = 1 ORDER BY id LIMIT 1 OFFSET ?', Math.floor(Math.random() * n));
  c.header('Cache-Control', 'no-store');
  return c.json({ slug: row?.slug });
});

publicRoutes.get('/theories/:slug', async (c) => {
  const db = Db.from(c.env);
  const detail = await loadTheoryDetail(db, c.req.param('slug'), c.get('locale'));
  if (!detail) throw notFound('Theory');
  publicCache(c, 60);
  return c.json(detail);
});

publicRoutes.get('/organizations', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const rows = await db.all(
    `SELECT o.*, l.lat, l.lng, l.name AS location_name FROM organizations o LEFT JOIN locations l ON l.id = o.location_id
     ORDER BY o.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  const items = await translate(db, c.get('locale'), 'organization', rows.map(mapOrganization), { name: 'name', description: 'description' });
  publicCache(c, 300);
  return c.json(paged(items, page, pageSize));
});

publicRoutes.get('/organizations/:slug', async (c) => {
  const db = Db.from(c.env);
  const row = await db.first(
    'SELECT o.*, l.lat, l.lng, l.name AS location_name FROM organizations o LEFT JOIN locations l ON l.id = o.location_id WHERE o.slug = ?',
    c.req.param('slug'),
  );
  if (!row) throw notFound('Organization');
  const [org] = await translate(db, c.get('locale'), 'organization', [mapOrganization(row)], { name: 'name', description: 'description' });
  const relationships = await loadRelationships(db, 'organization', org.id);
  publicCache(c, 300);
  return c.json({ ...org, relationships });
});

publicRoutes.get('/people', async (c) => {
  const db = Db.from(c.env);
  const { page, pageSize, offset, limit } = pageParams(c.req.query());
  const rows = await db.all('SELECT * FROM people ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?', limit, offset);
  const items = await translate(db, c.get('locale'), 'person', rows.map(mapPerson), { role: 'role', description: 'description' });
  publicCache(c, 300);
  return c.json(paged(items, page, pageSize));
});

publicRoutes.get('/people/:slug', async (c) => {
  const db = Db.from(c.env);
  const row = await db.first('SELECT * FROM people WHERE slug = ?', c.req.param('slug'));
  if (!row) throw notFound('Person');
  const [person] = await translate(db, c.get('locale'), 'person', [mapPerson(row)], { role: 'role', description: 'description' });
  const relationships = await loadRelationships(db, 'person', person.id);
  publicCache(c, 300);
  return c.json({ ...person, relationships });
});

/** All events for the timeline (bounded). Optional year range and category filter. */
publicRoutes.get('/events', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const where: string[] = [];
  const params: unknown[] = [];
  const from = parseInt(q.from ?? '', 10);
  const to = parseInt(q.to ?? '', 10);
  if (Number.isFinite(from)) {
    where.push('COALESCE(e.end_year, e.start_year) >= ?');
    params.push(from);
  }
  if (Number.isFinite(to)) {
    where.push('e.start_year <= ?');
    params.push(to);
  }
  if (q.category && (CATEGORY_SLUGS as readonly string[]).includes(q.category)) {
    where.push('c.slug = ?');
    params.push(q.category);
  }
  const rows = await db.all(
    `${EVENT_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY e.start_year, e.start_date LIMIT 2000`,
    ...params,
  );
  const items = await translate(db, c.get('locale'), 'event', rows.map(mapEvent), EVENT_FIELDS);
  publicCache(c, 300);
  return c.json({ items });
});

publicRoutes.get('/events/:slug', async (c) => {
  const db = Db.from(c.env);
  const row = await db.first(`${EVENT_SELECT} WHERE e.slug = ?`, c.req.param('slug'));
  if (!row) throw notFound('Event');
  const [event] = await translate(db, c.get('locale'), 'event', [mapEvent(row)], EVENT_FIELDS);
  const relationships = await loadRelationships(db, 'event', event.id);
  publicCache(c, 300);
  return c.json({ ...event, relationships });
});

/** Map data: locations with the events and organizations attached to them. */
publicRoutes.get('/map', async (c) => {
  const features = computeFeatures(c.env);
  if (!features.map_data.available) return c.json({ error: { code: 'unavailable', state: features.map_data.state, message: features.map_data.message } }, 503);
  const db = Db.from(c.env);
  const locale = c.get('locale');
  const [locRows, eventRows, orgRows, caseRows, theoryCount] = await Promise.all([
    db.all('SELECT * FROM locations ORDER BY name LIMIT 2000'),
    db.all(`${EVENT_SELECT} WHERE e.location_id IS NOT NULL ORDER BY e.start_year LIMIT 2000`),
    db.all('SELECT o.*, l.lat, l.lng, l.name AS location_name FROM organizations o JOIN locations l ON l.id = o.location_id LIMIT 2000'),
    // Cases are placed where the archive itself names a place: a direct link, or the place of a linked event.
    db.all(
      `SELECT DISTINCT x.location_id, t.id, t.slug, t.title, t.subtitle, c.slug AS category FROM (
         SELECT r.from_id AS theory_id, r.to_id AS location_id FROM relationships r WHERE r.from_type = 'theory' AND r.to_type = 'location'
         UNION SELECT r.to_id, r.from_id FROM relationships r WHERE r.to_type = 'theory' AND r.from_type = 'location'
         UNION SELECT r.from_id, e.location_id FROM relationships r JOIN events e ON e.id = r.to_id
           WHERE r.from_type = 'theory' AND r.to_type = 'event' AND e.location_id IS NOT NULL
         UNION SELECT r.to_id, e.location_id FROM relationships r JOIN events e ON e.id = r.from_id
           WHERE r.to_type = 'theory' AND r.from_type = 'event' AND e.location_id IS NOT NULL
       ) x JOIN theories t ON t.id = x.theory_id AND t.is_published = 1 JOIN categories c ON c.id = t.category_id
       ORDER BY t.title LIMIT 5000`,
    ),
    db.first<{ n: number }>('SELECT COUNT(*) AS n FROM theories WHERE is_published = 1'),
  ]);
  const events = await translate(db, locale, 'event', eventRows.map(mapEvent), EVENT_FIELDS);
  const orgs = await translate(db, locale, 'organization', orgRows.map((r) => ({ ...mapOrganization(r), locationId: Number(r.location_id) })), {
    name: 'name',
    description: 'description',
  });
  const cases = await translate(
    db,
    locale,
    'theory',
    caseRows.map((r) => ({ id: Number(r.id), slug: String(r.slug), title: String(r.title), subtitle: (r.subtitle as string) ?? null, category: String(r.category), locationId: Number(r.location_id) })),
    { title: 'title', subtitle: 'subtitle' },
  );
  const locations = locRows.map((r) => {
    const loc = mapLocation(r);
    return {
      ...loc,
      events: events.filter((e) => e.location?.id === loc.id),
      organizations: orgs.filter((o) => o.locationId === loc.id),
      theories: cases.filter((t) => t.locationId === loc.id).map(({ locationId: _, ...t }) => t),
    };
  });
  const placedCases = new Set(cases.map((t) => t.id)).size;
  publicCache(c, 600);
  return c.json({ locations, caseCount: Number(theoryCount?.n ?? 0), placedCases });
});

publicRoutes.get('/documents', async (c) => {
  const db = Db.from(c.env);
  const { page, pageSize, offset, limit } = pageParams(c.req.query());
  const rows = await db.all('SELECT * FROM documents ORDER BY published_date, title LIMIT ? OFFSET ?', limit, offset);
  publicCache(c, 300);
  return c.json(paged(rows.map(mapDocument), page, pageSize));
});

publicRoutes.get('/sources', async (c) => {
  const db = Db.from(c.env);
  const q = c.req.query();
  const { page, pageSize, offset, limit } = pageParams(q);
  const params: unknown[] = [];
  let where = '';
  if (q.primary === '1' || q.primary === '0') {
    where = 'WHERE is_primary = ?';
    params.push(Number(q.primary));
  }
  const rows = await db.all(`SELECT * FROM sources ${where} ORDER BY title COLLATE NOCASE LIMIT ? OFFSET ?`, ...params, limit, offset);
  publicCache(c, 300);
  return c.json(paged(rows.map((r) => mapSource(r)), page, pageSize));
});

/** Public boards only. Private investigation boards are served by the investigation routes. */
publicRoutes.get('/boards/:slug', async (c) => {
  const db = Db.from(c.env);
  const board = await db.first("SELECT * FROM boards WHERE slug = ? AND visibility = 'public'", c.req.param('slug'));
  if (!board) throw notFound('Board');
  const content = await loadBoardContent(db, Number(board.id), c.get('locale'));
  publicCache(c, 60);
  return c.json({ id: board.id, slug: board.slug, title: board.title, description: board.description, ...content });
});

/** Global search: titles and names first, then matches in descriptions. */
publicRoutes.get('/search', async (c) => {
  const db = Db.from(c.env);
  const q = (c.req.query('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return c.json({ theories: [], events: [], organizations: [], people: [] });
  const like = likeEscape(q);
  const [theories, events, organizations, people] = await Promise.all([
    db.all(
      `${THEORY_SUMMARY_SELECT} WHERE t.is_published = 1 AND (t.title LIKE ?1 ESCAPE '\\' OR t.subtitle LIKE ?1 ESCAPE '\\' OR t.summary LIKE ?1 ESCAPE '\\')
       ORDER BY (t.title LIKE ?1 ESCAPE '\\') DESC, t.title LIMIT 8`,
      like,
    ),
    db.all(
      `SELECT id, slug, title, start_year FROM events WHERE title LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
       ORDER BY (title LIKE ?1 ESCAPE '\\') DESC, start_year LIMIT 8`,
      like,
    ),
    db.all(
      `SELECT id, slug, name, kind FROM organizations WHERE name LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
       ORDER BY (name LIKE ?1 ESCAPE '\\') DESC, name LIMIT 8`,
      like,
    ),
    db.all(
      `SELECT id, slug, name, role FROM people WHERE name LIKE ?1 ESCAPE '\\' OR role LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
       ORDER BY (name LIKE ?1 ESCAPE '\\') DESC, name LIMIT 8`,
      like,
    ),
  ]);
  publicCache(c, 60);
  return c.json({ theories: theories.map(mapTheorySummary), events, organizations, people });
});
