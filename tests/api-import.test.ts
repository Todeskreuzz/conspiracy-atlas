import { afterEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { importFetch, guessCategory, matchKey, parseCandidates, IMPORT_BATCH } from '../server/importer';
import { runCostCheck } from '../scripts/cost-check.mjs';

const original = importFetch.impl;
afterEach(() => {
  importFetch.impl = original;
});

const binding = (qid: string, en: string, de?: string) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  en: { value: `https://en.wikipedia.org/wiki/${en}` },
  ...(de ? { de: { value: `https://de.wikipedia.org/wiki/${de}` } } : {}),
});

function summary(title: string, lang = 'en', type = 'standard') {
  return {
    type,
    title,
    description: `${title} description`,
    extract: `${title} is a conspiracy theory that has circulated widely. It is described here in a neutral way for testing.`,
    content_urls: { desktop: { page: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` } },
  };
}

/** Fake Wikidata + Wikipedia. `pages` maps "lang:Title" to a summary, null = 404. */
function fakeUpstream(bindings: unknown[], pages: Record<string, unknown | null>) {
  const calls: string[] = [];
  importFetch.impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://query.wikidata.org/')) {
      // The main query lists English articles only; German links come from a second query for the batch.
      const german = decodeURIComponent(url).includes('VALUES');
      const rows = (bindings as Record<string, unknown>[]).map(({ de, ...rest }) => (german ? { ...rest, de } : rest)).filter((r) => !german || r.de);
      return Response.json({ results: { bindings: rows } });
    }
    const m = url.match(/^https:\/\/(en|de)\.wikipedia\.org\/api\/rest_v1\/page\/summary\/([^?]+)/);
    const key = m ? `${m[1]}:${decodeURIComponent(m[2]).replace(/_/g, ' ')}` : '';
    const page = pages[key];
    return page ? Response.json(page) : new Response('not found', { status: 404 });
  }) as typeof fetch;
  return calls;
}

async function setup(enabled = true) {
  const env = await makeEnv({ FEATURE_AUTOMATIC_IMPORT: enabled ? 'true' : 'false' });
  return { env, visitor: client(env), raw: (env.DB as any).raw };
}

describe('automatic import', () => {
  it('is "Currently unavailable!" while the feature is switched off', async () => {
    const { visitor } = await setup(false);
    const r = await visitor.post('/api/import/run');
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });

  it('imports new theories neutrally with Wikipedia as source and a German translation', async () => {
    const { visitor, raw } = await setup();
    fakeUpstream(
      [binding('Q100', 'Birds_Aren%27t_Real', 'Birds_Aren%E2%80%99t_Real'), binding('Q50', 'Flat_Earth')],
      {
        "en:Birds Aren't Real": summary("Birds Aren't Real"),
        'de:Birds Aren’t Real': summary('Birds Aren’t Real', 'de'),
        'en:Flat Earth': summary('Flat Earth'),
      },
    );
    const r = await visitor.post('/api/import/run');
    expect(r.status).toBe(200);
    // Ordered by Wikidata number: Q50 first.
    expect(r.json.imported.map((i: any) => i.slug)).toEqual(['flat-earth', 'birds-aren-t-real']);

    const theory = await visitor.get('/api/theories/flat-earth');
    expect(theory.status).toBe(200);
    expect(theory.json.evidenceStatus).toBe('unverified');
    expect(theory.json.category).toBe('space-ufos');
    expect(theory.json.claims).toEqual([]);
    expect(JSON.stringify(theory.json.body)).toContain('CC BY-SA 4.0');
    const src = raw.prepare("SELECT s.url, s.source_type FROM sources s JOIN evidence e ON e.source_id = s.id JOIN theories t ON t.id = e.theory_id WHERE t.slug = 'flat-earth'").all();
    expect(src).toEqual([{ url: 'https://en.wikipedia.org/wiki/Flat_Earth', source_type: 'reference_work' }]);

    const de = await visitor.get('/api/theories/birds-aren-t-real?lang=de');
    expect(de.json.title).toBe('Birds Aren’t Real');
    // Not added to the investigation wall automatically.
    expect(raw.prepare("SELECT COUNT(*) AS n FROM board_nodes WHERE title = 'Flat Earth'").get().n).toBe(0);
  });

  it('runs at most every 20 minutes and never imports the same article twice', async () => {
    const { visitor, raw } = await setup();
    fakeUpstream([binding('Q50', 'Flat_Earth')], { 'en:Flat Earth': summary('Flat Earth') });
    expect((await visitor.post('/api/import/run')).json.imported).toHaveLength(1);
    expect((await visitor.post('/api/import/run')).status).toBe(429);

    raw.prepare("UPDATE settings SET value = '2000-01-01T00:00:00.000Z' WHERE key = 'import.last_run'").run();
    const again = await visitor.post('/api/import/run');
    expect(again.status).toBe(200);
    expect(again.json.imported).toEqual([]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM theories WHERE slug LIKE 'flat-earth%'").get().n).toBe(1);
  });

  it('skips hand-written cases, disambiguation pages and missing articles for good', async () => {
    const { visitor, raw } = await setup();
    const calls = fakeUpstream(
      [binding('Q1', 'Moon_landing_conspiracy_theories'), binding('Q2', 'Mercury'), binding('Q3', 'Deleted_article'), binding('Q4', 'Flat_Earth')],
      { 'en:Mercury': summary('Mercury', 'en', 'disambiguation'), 'en:Flat Earth': summary('Flat Earth') },
    );
    const r = await visitor.post('/api/import/run');
    expect(r.json.imported.map((i: any) => i.title)).toEqual(['Flat Earth']);
    expect(r.json.skipped).toBe(2);
    expect(calls.some((u) => u.includes('Moon_landing'))).toBe(false);

    raw.prepare("UPDATE settings SET value = '2000-01-01T00:00:00.000Z' WHERE key = 'import.last_run'").run();
    calls.length = 0;
    await visitor.post('/api/import/run');
    expect(calls.filter((u) => u.includes('rest_v1'))).toEqual([]);
  });

  it('stores at most one batch per run and reports upstream errors without writing', async () => {
    const { visitor, raw } = await setup();
    const many = Array.from({ length: IMPORT_BATCH + 5 }, (_, i) => binding(`Q${i + 10}`, `Theory_${i}`));
    const pages = Object.fromEntries(many.map((_, i) => [`en:Theory ${i}`, summary(`Theory ${i}`)]));
    fakeUpstream(many, pages);
    const r = await visitor.post('/api/import/run');
    expect(r.json.imported).toHaveLength(IMPORT_BATCH);
    expect(r.json.remaining).toBe(5);

    raw.prepare("UPDATE settings SET value = '2000-01-01T00:00:00.000Z' WHERE key = 'import.last_run'").run();
    importFetch.impl = (async () => new Response('busy', { status: 503 })) as unknown as typeof fetch;
    const failed = await visitor.post('/api/import/run');
    expect(failed.status).toBe(502);
    expect(failed.json.error).toMatch(/HTTP 503/);
    expect((await visitor.get('/api/import/status')).json.last.error).toMatch(/HTTP 503/);
  });
});

describe('import helpers', () => {
  it('matches Wikipedia titles to the hand-written cases', () => {
    expect(matchKey('Moon landing conspiracy theories')).toBe(matchKey('Moon Landing Conspiracy Theory'));
    expect(matchKey('Chemtrail conspiracy theory')).toBe(matchKey('Chemtrail Claims'));
    expect(matchKey('John F. Kennedy assassination conspiracy theories')).toBe(matchKey('JFK-related Conspiracy Narratives'));
    expect(matchKey('Illuminati')).toBe(matchKey('Illuminati Narratives'));
    expect(matchKey('Flat Earth')).not.toBe(matchKey('Hollow Earth'));
  });

  it('guesses a category and falls back to history', () => {
    expect(guessCategory('Reptilian conspiracy theory')).toBe('space-ufos');
    expect(guessCategory('Vaccines and autism')).toBe('science-technology');
    expect(guessCategory('Freemasonry conspiracy theories')).toBe('secret-organizations');
    expect(guessCategory('Pizzagate conspiracy theory')).toBe('internet-modern-myths');
    expect(guessCategory('Phantom time hypothesis')).toBe('history');
  });

  it('parses SPARQL results, drops duplicates and foreign hosts', () => {
    const c = parseCandidates({
      results: { bindings: [binding('Q7', 'A'), binding('Q7', 'A'), { item: { value: 'x/Q8' }, en: { value: 'https://evil.example/wiki/B' } }] },
    });
    expect(c).toEqual([{ qid: 'Q7', enUrl: 'https://en.wikipedia.org/wiki/A', deUrl: null }]);
  });

  it('keeps the cost check green', () => {
    expect(runCostCheck()).toEqual([]);
  });
});
