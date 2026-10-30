import { describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { caseOfTheDayIndex } from '../server/routes/public';

describe('public API', () => {
  it('lists seeded theories with pagination', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/theories?pageSize=5');
    expect(r.status).toBe(200);
    expect(r.json.items).toHaveLength(5);
    expect(r.json.hasMore).toBe(true);
    const p3 = await c.get('/api/theories?pageSize=5&page=3');
    expect(p3.json.items).toHaveLength(4);
    expect(p3.json.hasMore).toBe(false);
    const p2 = await c.get('/api/theories?pageSize=5&page=2');
    expect(p2.json.items).toHaveLength(5);
    expect(p2.json.hasMore).toBe(true);
  });

  it('returns a theory detail with claims, evidence and counter-arguments', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/theories/operation-northwoods');
    expect(r.status).toBe(200);
    expect(r.json.title).toBe('Operation Northwoods');
    expect(r.json.claims.length).toBeGreaterThan(2);
    expect(r.json.claims[0].evidence[0].source.isPrimary).toBe(true);
    expect(r.json.counterArguments.length).toBeGreaterThan(0);
    expect(r.json.events.length).toBeGreaterThan(0);
    expect(r.json.relationships.some((x: any) => x.other.type === 'organization')).toBe(true);
  });

  it('localises content to German with English fallback', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/theories/moon-landing-conspiracy-theory?lang=de');
    expect(r.json.title).toBe('Verschwörungstheorie zur Mondlandung');
    expect(r.json.claims[1].text).toContain('Studio');
  });

  it('filters by category and status', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/theories?category=space-ufos');
    expect(r.json.items.map((t: any) => t.slug).sort()).toEqual(['area-51', 'moon-landing-conspiracy-theory', 'roswell-incident']);
    const d = await c.get('/api/theories?status=debunked');
    expect(d.json.items.every((t: any) => t.evidenceStatus === 'debunked')).toBe(true);
  });

  it('serves the main board with nodes and threads', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/boards/main');
    expect(r.status).toBe(200);
    expect(r.json.nodes.length).toBeGreaterThan(50);
    expect(r.json.edges.length).toBeGreaterThan(50);
    const ids = new Set(r.json.nodes.map((n: any) => n.id));
    expect(r.json.edges.every((e: any) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it('adds automatic threads between cases that name the same person, organization or place', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/boards/main');
    const auto = r.json.edges.filter((e: any) => e.auto);
    expect(auto.length).toBeGreaterThan(0);
    const byId = new Map(r.json.nodes.map((n: any) => [n.id, n]));
    const stored = new Set(r.json.edges.filter((e: any) => !e.auto).map((e: any) => [e.source, e.target].sort().join('-')));
    for (const e of auto) {
      expect(e.id).toBeLessThan(0);
      expect(e.verification).toBe('suggested');
      expect((byId.get(e.source) as any).entityType).toBe('theory');
      expect((byId.get(e.target) as any).entityType).toBe('theory');
      expect(e.shared.length).toBeGreaterThan(0);
      expect(e.shared.every((s: any) => ['person', 'organization', 'location'].includes(s.type))).toBe(true);
      expect(stored.has([e.source, e.target].sort().join('-'))).toBe(false);
    }
    const titles = auto.map((e: any) => [(byId.get(e.source) as any).title, (byId.get(e.target) as any).title].sort().join(' | '));
    expect(titles).toContain('Area 51 | MKUltra');
    // A place named by many cases (Washington, D.C.) is too generic to create threads.
    expect(auto.some((e: any) => e.shared.some((s: any) => s.title === 'Washington, D.C.'))).toBe(false);
  });

  it('places case files on the map where the archive names a place', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/map');
    expect(r.status).toBe(200);
    const withCases = r.json.locations.filter((l: any) => l.theories.length);
    expect(withCases.length).toBeGreaterThan(3);
    expect(r.json.placedCases).toBeGreaterThan(5);
    expect(r.json.placedCases).toBeLessThanOrEqual(r.json.caseCount);
    const all = withCases.flatMap((l: any) => l.theories.map((t: any) => t.slug));
    expect(all).toContain('mkultra');
    const de = await c.get('/api/map?lang=de');
    const moon = de.json.locations.flatMap((l: any) => l.theories).find((t: any) => t.slug === 'moon-landing-conspiracy-theory');
    if (moon) expect(moon.title).toBe('Verschwörungstheorie zur Mondlandung');
  });

  it('serves the same case of the day for everyone and a random case', async () => {
    const c = client(await makeEnv());
    const a = await c.get('/api/case-of-the-day');
    const b = await c.get('/api/case-of-the-day');
    expect(a.status).toBe(200);
    expect(a.json.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.json.theory.slug).toBeTruthy();
    expect(b.json.theory.slug).toBe(a.json.theory.slug);
    const r = await c.get('/api/random-case');
    expect((await c.get(`/api/theories/${r.json.slug}`)).status).toBe(200);
  });

  it('spreads the case of the day over the archive', () => {
    const picks = new Set(Array.from({ length: 60 }, (_, i) => caseOfTheDayIndex(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), 25)));
    expect(picks.size).toBeGreaterThan(12);
    expect([...picks].every((p) => p >= 0 && p < 25)).toBe(true);
  });

  it('derives threads between saved cases for the personal wall', async () => {
    const c = client(await makeEnv());
    const ids = await Promise.all(['mkultra', 'area-51', 'cointelpro'].map(async (s) => (await c.get(`/api/theories/${s}`)).json.id));
    const r = await c.get(`/api/shared-threads?ids=${ids.join(',')},abc,-1`);
    expect(r.status).toBe(200);
    expect(r.json.edges.length).toBeGreaterThan(0);
    expect(r.json.edges.every((e: any) => ids.includes(e.source) && ids.includes(e.target) && e.auto)).toBe(true);
    expect((await c.get('/api/shared-threads')).json.edges).toEqual([]);
  });

  it('serves events for the timeline and map data', async () => {
    const c = client(await makeEnv());
    const ev = await c.get('/api/events?from=1960&to=1980');
    expect(ev.json.items.length).toBeGreaterThan(5);
    expect(ev.json.items.every((e: any) => (e.endYear ?? e.startYear) >= 1960 && e.startYear <= 1980)).toBe(true);
    const map = await c.get('/api/map');
    expect(map.json.locations.find((l: any) => l.slug === 'groom-lake').events.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown theories and does not expose private boards', async () => {
    const c = client(await makeEnv());
    expect((await c.get('/api/theories/does-not-exist')).status).toBe(404);
    expect((await c.get('/api/boards/inv-123')).status).toBe(404);
  });

  it('search escapes LIKE wildcards', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/search?q=%25%25');
    expect(r.json.theories).toHaveLength(0);
    const ok = await c.get('/api/search?q=water');
    expect(ok.json.theories[0].slug).toBe('watergate');
  });

  it('search matches descriptions and ranks title matches first', async () => {
    const c = client(await makeEnv());
    const byDescription = await c.get('/api/search?q=canon%20law');
    expect(byDescription.json.people.map((p: { slug: string }) => p.slug)).toContain('weishaupt');
    const r = await c.get('/api/search?q=Watergate');
    expect(r.json.theories[0].slug).toBe('watergate');
    expect(r.json.people.map((p: { name: string }) => p.name)).toContain('Richard Nixon');
  });
});
