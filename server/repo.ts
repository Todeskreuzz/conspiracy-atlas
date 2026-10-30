// Read models and mappers. All queries are parameterised and bounded by LIMIT or indexed lookups.
import { mapImage } from './images';
import type { Db, Row } from './db';
import { parseJsonArray } from './db';
import type { EntityType, Locale } from '../shared/constants';
import type {
  BoardEdge,
  BoardNode,
  Claim,
  CounterArgument,
  DocumentItem,
  EntityRef,
  EventSummary,
  EvidenceLink,
  LocationItem,
  Organization,
  Person,
  Relationship,
  Source,
  TheoryDetail,
  TheorySummary,
} from '../shared/types';
import type { RichNode } from '../shared/richtext';

// D1 allows at most 100 bound parameters per statement.
export const MAX_PARAMS = 90;

export function chunk<T>(items: T[], size = MAX_PARAMS): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

/** Overlays translated fields (non-English locales) onto rows. */
export async function translate<T extends { id: number }>(
  db: Db,
  locale: Locale,
  entityType: string,
  rows: T[],
  fields: Record<string, keyof T>,
): Promise<T[]> {
  if (locale === 'en' || rows.length === 0) return rows;
  const ids = [...new Set(rows.map((r) => r.id))];
  const found: Row[] = [];
  if (ids.length > MAX_PARAMS * 3) {
    found.push(...(await db.all('SELECT entity_id, field, value FROM translations WHERE entity_type = ? AND locale = ?', entityType, locale)));
  } else {
    for (const part of chunk(ids)) {
      found.push(
        ...(await db.all(
          `SELECT entity_id, field, value FROM translations WHERE entity_type = ? AND locale = ? AND entity_id IN (${placeholders(part.length)})`,
          entityType,
          locale,
          ...part,
        )),
      );
    }
  }
  const byId = new Map<number, Record<string, string>>();
  for (const r of found) {
    const m = byId.get(Number(r.entity_id)) ?? {};
    m[String(r.field)] = String(r.value);
    byId.set(Number(r.entity_id), m);
  }
  return rows.map((row) => {
    const t = byId.get(row.id);
    if (!t) return row;
    const copy = { ...row };
    for (const [field, key] of Object.entries(fields)) if (t[field]) (copy as Record<string, unknown>)[key as string] = t[field];
    return copy;
  });
}

export const THEORY_SUMMARY_SELECT = `
  SELECT t.id, t.slug, t.title, t.subtitle, t.summary, c.slug AS category, t.evidence_status, t.image_path,
         t.origin, a.display_name AS author_name, t.updated_at,
         (SELECT group_concat(tg.name, '|') FROM theory_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.theory_id = t.id) AS tags
  FROM theories t
  JOIN categories c ON c.id = t.category_id
  LEFT JOIN authors a ON a.id = t.author_id`;

export function mapTheorySummary(r: Row): TheorySummary {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    subtitle: (r.subtitle as string) ?? null,
    summary: String(r.summary),
    category: r.category as TheorySummary['category'],
    evidenceStatus: r.evidence_status as TheorySummary['evidenceStatus'],
    imagePath: (r.image_path as string) ?? null,
    origin: r.origin as TheorySummary['origin'],
    authorName: (r.author_name as string) ?? null,
    tags: r.tags ? String(r.tags).split('|') : [],
    updatedAt: String(r.updated_at),
  };
}

export const THEORY_FIELDS = { title: 'title', subtitle: 'subtitle', summary: 'summary' } as const;

export function mapSource(r: Row, prefix = ''): Source {
  const g = (k: string) => r[prefix + k];
  return {
    id: Number(g('id')),
    title: String(g('title')),
    publisher: (g('publisher') as string) ?? null,
    author: (g('author') as string) ?? null,
    publishedDate: (g('published_date') as string) ?? null,
    sourceType: g('source_type') as Source['sourceType'],
    isPrimary: Number(g('is_primary')) === 1,
    url: (g('url') as string) ?? null,
    lastChecked: (g('last_checked') as string) ?? null,
    qualityNote: (g('quality_note') as string) ?? null,
    notes: (g('notes') as string) ?? null,
  };
}

export function mapEvent(r: Row): EventSummary {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: (r.description as string) ?? null,
    startDate: (r.start_date as string) ?? null,
    endDate: (r.end_date as string) ?? null,
    startYear: Number(r.start_year),
    endYear: r.end_year === null || r.end_year === undefined ? null : Number(r.end_year),
    isPeriod: Number(r.is_period) === 1,
    evidenceStatus: r.evidence_status as EventSummary['evidenceStatus'],
    category: (r.category as EventSummary['category']) ?? null,
    location:
      r.location_id !== null && r.location_id !== undefined
        ? {
            id: Number(r.location_id),
            name: String(r.location_name),
            lat: Number(r.lat),
            lng: Number(r.lng),
            countryCode: (r.country_code as string) ?? null,
          }
        : null,
    theoryIds: r.theory_ids ? String(r.theory_ids).split(',').map(Number) : [],
  };
}

export const EVENT_SELECT = `
  SELECT e.id, e.slug, e.title, e.description, e.start_date, e.end_date, e.start_year, e.end_year, e.is_period,
         e.evidence_status, c.slug AS category, e.location_id, l.name AS location_name, l.lat, l.lng, l.country_code,
         (SELECT group_concat(r.from_id) FROM relationships r WHERE r.to_type = 'event' AND r.to_id = e.id AND r.from_type = 'theory') AS theory_ids
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN locations l ON l.id = e.location_id`;

export const EVENT_FIELDS = { title: 'title', description: 'description' } as const;

export function mapOrganization(r: Row): Organization {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    kind: String(r.kind),
    description: (r.description as string) ?? null,
    founded: (r.founded as string) ?? null,
    country: (r.country as string) ?? null,
    location: r.lat !== null && r.lat !== undefined ? { lat: Number(r.lat), lng: Number(r.lng), name: String(r.location_name) } : null,
  };
}

export function mapPerson(r: Row): Person {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    role: (r.role as string) ?? null,
    description: (r.description as string) ?? null,
    born: (r.born as string) ?? null,
    died: (r.died as string) ?? null,
  };
}

export function mapLocation(r: Row): LocationItem {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    countryCode: (r.country_code as string) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    regionKind: String(r.region_kind),
    description: (r.description as string) ?? null,
  };
}

export function mapDocument(r: Row): DocumentItem {
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: (r.description as string) ?? null,
    documentType: String(r.document_type),
    url: (r.url as string) ?? null,
    publishedDate: (r.published_date as string) ?? null,
    archiveName: (r.archive_name as string) ?? null,
    licenseNote: (r.license_note as string) ?? null,
  };
}

const ENTITY_TABLES: Record<EntityType, { table: string; title: string; slug: string | null; pub?: string }> = {
  theory: { table: 'theories', title: 'title', slug: 'slug', pub: 'is_published = 1' },
  event: { table: 'events', title: 'title', slug: 'slug' },
  organization: { table: 'organizations', title: 'name', slug: 'slug' },
  person: { table: 'people', title: 'name', slug: 'slug' },
  location: { table: 'locations', title: 'name', slug: 'slug' },
  document: { table: 'documents', title: 'title', slug: 'slug' },
  source: { table: 'sources', title: 'title', slug: null },
  claim: { table: 'claims', title: 'text', slug: null },
};

/** Resolves titles and slugs for polymorphic references (grouped per type, chunked). */
export async function resolveRefs(db: Db, refs: Array<{ type: EntityType; id: number }>): Promise<Map<string, EntityRef>> {
  const out = new Map<string, EntityRef>();
  const byType = new Map<EntityType, number[]>();
  for (const r of refs) {
    if (!ENTITY_TABLES[r.type]) continue;
    const list = byType.get(r.type) ?? [];
    if (!list.includes(r.id)) list.push(r.id);
    byType.set(r.type, list);
  }
  for (const [type, ids] of byType) {
    const meta = ENTITY_TABLES[type];
    for (const part of chunk(ids)) {
      const rows = await db.all(
        `SELECT id, ${meta.title} AS title, ${meta.slug ?? 'NULL'} AS slug FROM ${meta.table}
         WHERE id IN (${placeholders(part.length)})${meta.pub ? ` AND ${meta.pub}` : ''}`,
        ...part,
      );
      for (const r of rows) {
        out.set(`${type}:${r.id}`, { type, id: Number(r.id), title: String(r.title), slug: (r.slug as string) ?? null });
      }
    }
  }
  return out;
}

export async function loadRelationships(db: Db, type: EntityType, id: number): Promise<Relationship[]> {
  const [outRows, inRows] = await Promise.all([
    db.all('SELECT * FROM relationships WHERE from_type = ? AND from_id = ? LIMIT 200', type, id),
    db.all('SELECT * FROM relationships WHERE to_type = ? AND to_id = ? LIMIT 200', type, id),
  ]);
  const refs = [
    ...outRows.map((r) => ({ type: r.to_type as EntityType, id: Number(r.to_id) })),
    ...inRows.map((r) => ({ type: r.from_type as EntityType, id: Number(r.from_id) })),
  ];
  const resolved = await resolveRefs(db, refs);
  const result: Relationship[] = [];
  const push = (r: Row, direction: 'out' | 'in') => {
    const otherType = (direction === 'out' ? r.to_type : r.from_type) as EntityType;
    const otherId = Number(direction === 'out' ? r.to_id : r.from_id);
    const other = resolved.get(`${otherType}:${otherId}`);
    if (!other) return; // unpublished or missing target is never exposed
    result.push({
      id: Number(r.id),
      kind: r.kind as Relationship['kind'],
      verification: r.verification as Relationship['verification'],
      label: (r.label as string) ?? null,
      note: (r.note as string) ?? null,
      direction,
      other,
    });
  };
  outRows.forEach((r) => push(r, 'out'));
  inRows.forEach((r) => push(r, 'in'));
  return result;
}

export async function loadTheoryDetail(db: Db, slug: string, locale: Locale, includeUnpublished = false): Promise<TheoryDetail | null> {
  const row = await db.first(
    `${THEORY_SUMMARY_SELECT} WHERE t.slug = ?${includeUnpublished ? '' : ' AND t.is_published = 1'}`,
    slug,
  );
  if (!row) return null;
  const id = Number(row.id);
  const [full, claimRows, counterRows, evidenceRows, relationships] = await Promise.all([
    db.first('SELECT background, origin_story, body_json, image_credit FROM theories WHERE id = ?', id),
    db.all('SELECT id, text, evidence_status FROM claims WHERE theory_id = ? ORDER BY position, id LIMIT 200', id),
    db.all('SELECT id, claim_id, text FROM counter_arguments WHERE theory_id = ? ORDER BY position, id LIMIT 200', id),
    db.all(
      `SELECT e.id AS ev_id, e.claim_id, e.counter_argument_id, e.relation, e.note AS ev_note, s.*
       FROM evidence e JOIN sources s ON s.id = e.source_id WHERE e.theory_id = ? LIMIT 500`,
      id,
    ),
    loadRelationships(db, 'theory', id),
  ]);

  const toLink = (r: Row): EvidenceLink => ({
    id: Number(r.ev_id),
    relation: r.relation as EvidenceLink['relation'],
    note: (r.ev_note as string) ?? null,
    source: mapSource(r),
  });

  let claims: Claim[] = claimRows.map((c) => ({
    id: Number(c.id),
    text: String(c.text),
    evidenceStatus: c.evidence_status as Claim['evidenceStatus'],
    evidence: evidenceRows.filter((e) => Number(e.claim_id) === Number(c.id)).map(toLink),
  }));
  let counterArguments: CounterArgument[] = counterRows.map((c) => ({
    id: Number(c.id),
    claimId: c.claim_id === null ? null : Number(c.claim_id),
    text: String(c.text),
    evidence: evidenceRows.filter((e) => Number(e.counter_argument_id) === Number(c.id)).map(toLink),
  }));
  const generalSources = evidenceRows.filter((e) => e.claim_id === null && e.counter_argument_id === null).map(toLink);

  const eventIds = relationships.filter((r) => r.other.type === 'event').map((r) => r.other.id);
  let events: EventSummary[] = [];
  if (eventIds.length) {
    events = (
      await db.all(`${EVENT_SELECT} WHERE e.id IN (${placeholders(Math.min(eventIds.length, MAX_PARAMS))}) ORDER BY e.start_year`, ...eventIds.slice(0, MAX_PARAMS))
    ).map(mapEvent);
    events = await translate(db, locale, 'event', events, EVENT_FIELDS);
  }

  let body: RichNode | null = null;
  if (full?.body_json) {
    try {
      body = JSON.parse(String(full.body_json));
    } catch {
      body = null;
    }
  }

  let detail: TheoryDetail = {
    ...mapTheorySummary(row),
    background: (full?.background as string) ?? null,
    originStory: (full?.origin_story as string) ?? null,
    imageCredit: (full?.image_credit as string) ?? null,
    body,
    claims,
    counterArguments,
    generalSources,
    relationships,
    events,
    images: (
      await db.all("SELECT public_id, mime, width, height, size, alt FROM images WHERE theory_id = ? AND status = 'approved' ORDER BY position", id)
    ).map((r) => mapImage(r, '/api/images')),
  };
  if (locale !== 'en') {
    [detail] = await translate(db, locale, 'theory', [detail], {
      ...THEORY_FIELDS,
      background: 'background',
      origin_story: 'originStory',
    });
    claims = await translate(db, locale, 'claim', detail.claims, { text: 'text' });
    counterArguments = await translate(db, locale, 'counter_argument', detail.counterArguments, { text: 'text' });
    detail = { ...detail, claims, counterArguments };
  }
  return detail;
}

export function mapBoardNode(r: Row): BoardNode {
  return {
    id: Number(r.id),
    entityType: (r.entity_type as BoardNode['entityType']) ?? null,
    entityId: r.entity_id === null || r.entity_id === undefined ? null : Number(r.entity_id),
    entitySlug: (r.entity_slug as string) ?? null,
    kind: r.kind as BoardNode['kind'],
    title: String(r.title),
    summary: (r.summary as string) ?? null,
    category: (r.category_slug as BoardNode['category']) ?? null,
    evidenceStatus: (r.evidence_status as BoardNode['evidenceStatus']) ?? null,
    imagePath: (r.image_path as string) ?? null,
    tags: parseJsonArray<string>(r.tags_json),
    groupKey: (r.group_key as string) ?? null,
    x: Number(r.x ?? 0),
    y: Number(r.y ?? 0),
  };
}

export function mapBoardEdge(r: Row): BoardEdge {
  return {
    id: Number(r.id),
    source: Number(r.source_node_id),
    target: Number(r.target_node_id),
    kind: r.kind as BoardEdge['kind'],
    verification: r.verification as BoardEdge['verification'],
    label: (r.label as string) ?? null,
  };
}

/** Loads a whole board with two indexed queries (+ optional translation overlay). */
export async function loadBoardContent(db: Db, boardId: number, locale: Locale) {
  const [nodeRows, edgeRows] = await Promise.all([
    db.all(
      `SELECT n.*, p.x, p.y,
              CASE n.entity_type
                WHEN 'theory' THEN (SELECT slug FROM theories WHERE id = n.entity_id)
                WHEN 'event' THEN (SELECT slug FROM events WHERE id = n.entity_id)
                WHEN 'organization' THEN (SELECT slug FROM organizations WHERE id = n.entity_id)
                WHEN 'person' THEN (SELECT slug FROM people WHERE id = n.entity_id)
                WHEN 'document' THEN (SELECT slug FROM documents WHERE id = n.entity_id)
                WHEN 'location' THEN (SELECT slug FROM locations WHERE id = n.entity_id)
                ELSE NULL END AS entity_slug
       FROM board_nodes n LEFT JOIN board_positions p ON p.board_id = n.board_id AND p.node_id = n.id
       WHERE n.board_id = ? LIMIT 5000`,
      boardId,
    ),
    db.all('SELECT * FROM board_edges WHERE board_id = ? LIMIT 20000', boardId),
  ]);
  let nodes = nodeRows.map(mapBoardNode);
  if (locale !== 'en') {
    // Translate theory-backed cards via the theory translations.
    const theoryNodes = nodes.filter((n) => n.entityType === 'theory' && n.entityId !== null);
    if (theoryNodes.length) {
      const pseudo = theoryNodes.map((n) => ({ id: n.entityId as number, title: n.title, summary: n.summary }));
      const translated = await translate(db, locale, 'theory', pseudo, { title: 'title', summary: 'summary' });
      const byId = new Map(translated.map((t) => [t.id, t]));
      nodes = nodes.map((n) => {
        const t = n.entityType === 'theory' && n.entityId !== null ? byId.get(n.entityId) : undefined;
        return t ? { ...n, title: t.title, summary: t.summary } : n;
      });
    }
  }
  return { nodes, edges: edgeRows.map(mapBoardEdge) };
}
