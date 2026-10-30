import { describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { createDb } from './helpers/d1';
import { Db } from '../server/db';
import { addCaseYears, caseYearQuery, parseCaseYears } from '../server/caseYears';

const row = (qid: string, start?: string, end?: string) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  ...(start !== undefined ? { start: { value: start } } : {}),
  ...(end !== undefined ? { end: { value: end } } : {}),
});

/** An imported case as the importer stores it: the Wikidata item is named in the source note. */
function addImported(raw: ReturnType<typeof createDb>['raw'], slug: string, qid: string): number {
  const id = Number(
    raw
      .prepare("INSERT INTO theories (slug, title, summary, category_id, evidence_status) SELECT ?, ?, 'Summary.', id, 'unverified' FROM categories WHERE slug = 'history' RETURNING id")
      .get(slug, slug)!.id,
  );
  const src = raw
    .prepare("INSERT INTO sources (title, source_type, notes) VALUES (?, 'reference_work', ?) RETURNING id")
    .get(`${slug} – Wikipedia`, `Imported automatically from Wikidata item ${qid}. Text licence: CC BY-SA 4.0.`)!.id;
  raw.prepare("INSERT INTO evidence (source_id, theory_id, relation) VALUES (?, ?, 'context')").run(src, id);
  return id;
}

describe('case years', () => {
  it('parses Wikidata years and drops impossible ones', () => {
    const now = new Date('2026-10-30');
    const years = parseCaseYears({ results: { bindings: [row('Q1', '1947'), row('Q2', '1963', '1979'), row('Q3', '2999'), row('Q4'), row('Q5', '1990', '1980')] } }, now);
    expect([...years]).toEqual([
      ['Q1', [1947, null]],
      ['Q2', [1963, 1979]],
      ['Q5', [1990, null]],
    ]);
    expect(caseYearQuery(['Q1', 'Q2'])).toContain('VALUES ?item { wd:Q1 wd:Q2 }');
  });

  it('stores the years of imported cases once and marks items without a date', async () => {
    const fake = createDb();
    const a = addImported(fake.raw, 'imported-a', 'Q100');
    const b = addImported(fake.raw, 'imported-b', 'Q200');
    const db = Db.from({ DB: fake as unknown as D1Database } as never);
    const queries: string[] = [];
    const found = await addCaseYears(db, async (q) => {
      queries.push(q);
      return { results: { bindings: [row('Q100', '1969', '1972')] } };
    });
    expect(found).toBe(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('wd:Q100 wd:Q200');
    const get = (id: number) => fake.raw.prepare('SELECT year_start, year_end, year_source FROM theories WHERE id = ?').get(id);
    expect(get(a)).toEqual({ year_start: 1969, year_end: 1972, year_source: 'wikidata' });
    expect(get(b)).toEqual({ year_start: null, year_end: null, year_source: 'none' });
    // Hand-written cases are never sent to Wikidata, and checked cases are not asked again.
    expect(await addCaseYears(db, async () => Promise.reject(new Error('not called')))).toBe(0);
  });

  it('puts cases on the timeline by their Wikidata year or by their linked events', async () => {
    const fake = createDb();
    const id = addImported(fake.raw, 'imported-dated', 'Q300');
    fake.raw.prepare("UPDATE theories SET year_start = 1898, year_source = 'wikidata' WHERE id = ?").run(id);
    addImported(fake.raw, 'imported-undated', 'Q400');
    const c = client(await makeEnv({}, fake));
    const r = await c.get('/api/timeline/cases');
    expect(r.status).toBe(200);
    const bySlug = new Map(r.json.items.map((x: any) => [x.slug, x]));
    expect(bySlug.get('imported-dated')).toMatchObject({ startYear: 1898, endYear: null, yearSource: 'wikidata' });
    expect(bySlug.has('imported-undated')).toBe(false);
    const northwoods = bySlug.get('operation-northwoods') as any;
    expect(northwoods.yearSource).toBe('events');
    expect(northwoods.startYear).toBeGreaterThanOrEqual(1960);
    const years = r.json.items.map((x: any) => x.startYear);
    expect(years).toEqual([...years].sort((x: number, y: number) => x - y));
    const de = await c.get('/api/timeline/cases', { 'Accept-Language': 'de' });
    expect(de.json.items.find((x: any) => x.slug === 'operation-northwoods').title).toBeTruthy();
  });
});

describe('case years before migration 0007', () => {
  it('still places cases by their events when the year columns are missing', async () => {
    const fake = createDb();
    fake.raw.exec('DROP INDEX idx_theories_year; ALTER TABLE theories DROP COLUMN year_start; ALTER TABLE theories DROP COLUMN year_end; ALTER TABLE theories DROP COLUMN year_source;');
    const r = await client(await makeEnv({}, fake)).get('/api/timeline/cases');
    expect(r.status).toBe(200);
    expect(r.json.items.find((x: any) => x.slug === 'operation-northwoods').yearSource).toBe('events');
  });
});
