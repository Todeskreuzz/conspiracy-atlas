import { afterEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { importFetch, guessCategory, isFreeLicense, isTheoryPage, isCoverCandidate, matchKey, parseCandidates, articleDetails, IMPORT_BATCH, MAX_SUBREQUESTS } from '../server/importer';
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
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);

/** Lead images per article title: file name and licence (NonFree marks a fair-use file). */
type FakeImage = { file: string; license: string; nonFree?: boolean };

/** A plain-text article as the TextExtracts API returns it (exsectionformat=wiki). */
export function article(title: string) {
  return [
    `${title} is a conspiracy theory that has circulated widely.`,
    `Proponents claim that the truth about ${title} has been hidden from the public for decades.`,
    '',
    '== Origins ==',
    `The idea of ${title} first appeared in a pamphlet in 1903.`,
    '',
    '== Claims ==',
    '=== Cover-up ===',
    'Believers say that the government hides the evidence. They point to missing files.',
    '=== Secret group ===',
    'A secret group is said to control the story.',
    '',
    '== Spread ==',
    'The theory spread on radio shows in the 1990s and later online.',
    '',
    '== See also ==',
    'Other theories',
    '',
    '== References ==',
  ].join('\n');
}

function fakeUpstream(
  bindings: unknown[],
  pages: Record<string, unknown | null>,
  listPages: unknown[][] = [],
  images: Record<string, FakeImage> = {},
  extra: { articles?: Record<string, string | null>; p18?: Record<string, string>; pageFiles?: Record<string, string[]>; licenses?: Record<string, string> } = {},
) {
  const calls: string[] = [];
  /** Licences of files that are not a lead image (Wikidata image, other photos in the article). */
  const extraFiles: Record<string, string> = (extra as { licenses?: Record<string, string> }).licenses ?? {};
  importFetch.impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://thumb.wikimedia.org/')) return new Response(JPEG);
    const titles = () => decodeURIComponent(new URL(url).searchParams.get('titles') ?? '').split('|');
    if (url.includes('prop=extracts')) {
      return Response.json({ query: { pages: titles().map((t) => (extra.articles?.[t] === null ? { title: t, missing: true } : { title: t, extract: extra.articles?.[t] ?? article(t) })) } });
    }
    if (url.includes('prop=images')) {
      return Response.json({ query: { pages: titles().map((t) => ({ title: t, images: (extra.pageFiles?.[t] ?? []).map((f) => ({ title: f })) })) } });
    }
    if (url.startsWith('https://query.wikidata.org/') && decodeURIComponent(url).includes('P18')) {
      const rows = Object.entries(extra.p18 ?? {}).map(([qid, file]) => ({
        item: { value: `http://www.wikidata.org/entity/${qid}` },
        img: { value: `http://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}` },
      }));
      return Response.json({ results: { bindings: rows } });
    }
    if (url.includes('prop=pageimages')) {
      return Response.json({ query: { pages: titles().map((t) => ({ title: t, ...(images[t] ? { pageimage: images[t].file.replace(/ /g, '_') } : {}) })) } });
    }
    if (url.includes('prop=imageinfo')) {
      const byFile = new Map(Object.values(images).map((i) => [`File:${i.file}`, i]));
      for (const [file, license] of Object.entries(extraFiles)) byFile.set(file, { file: file.slice(5), license });
      return Response.json({
        query: {
          pages: titles().map((t) => {
            const i = byFile.get(t);
            if (!i) return { title: t, missing: true };
            return {
              title: t,
              imageinfo: [{
                thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(i.file)}/640px-x.jpg`,
                thumbwidth: 640,
                thumbheight: 480,
                descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(t)}`,
                extmetadata: { LicenseShortName: { value: i.license }, Artist: { value: '<a href="x">Jane Doe</a>' }, ...(i.nonFree ? { NonFree: { value: 'true' } } : {}) },
              }],
            };
          }),
        },
      });
    }
    if (url.startsWith('https://en.wikipedia.org/w/api.php')) {
      // Two result pages, linked by a continuation token like the real API.
      const n = url.includes('gplcontinue=') ? 1 : 0;
      if (!listPages[n]) return new Response('not found', { status: 404 });
      return Response.json({ query: { pages: listPages[n] }, ...(listPages[n + 1] ? { continue: { gplcontinue: 'x|0|B', continue: 'gplcontinue||' } } : {}) });
    }
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
    expect(JSON.stringify(theory.json.body)).toContain('CC BY-SA 4.0');
    // Filled from the full article in the same run.
    expect(r.json.detailed).toBe(2);
    expect(theory.json.imported).toBe(true);
    expect(theory.json.originStory).toBe('The idea of Flat Earth first appeared in a pamphlet in 1903.');
    expect(theory.json.claims.map((c: any) => c.text)).toEqual([
      'Cover-up: Believers say that the government hides the evidence. They point to missing files.',
      'Secret group: A secret group is said to control the story.',
    ]);
    expect(theory.json.claims[0].evidence[0].source.url).toBe('https://en.wikipedia.org/wiki/Flat_Earth');
    const headings = theory.json.body.content.filter((n: any) => n.type === 'heading').map((n: any) => n.content[0].text);
    expect(headings).toEqual(['Spread']); // origin and claims have their own fields; see also / references dropped
    const src = raw.prepare("SELECT s.url, s.source_type FROM sources s JOIN evidence e ON e.source_id = s.id JOIN theories t ON t.id = e.theory_id WHERE t.slug = 'flat-earth' AND e.claim_id IS NULL").all();
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

describe('cover images', () => {
  it('stores a freely licensed lead image in D1 with credit, skips non-free ones and backfills older entries', async () => {
    const { visitor, raw } = await setup();
    fakeUpstream(
      [binding('Q50', 'Flat_Earth'), binding('Q60', 'Hollow_Earth')],
      { 'en:Flat Earth': summary('Flat Earth'), 'en:Hollow Earth': summary('Hollow Earth') },
      [],
      { 'Flat Earth': { file: 'Flat earth.png', license: 'CC BY-SA 4.0' }, 'Hollow Earth': { file: 'Poster.jpg', license: 'Fair use', nonFree: true } },
    );
    const r = await visitor.post('/api/import/run');
    expect(r.json.images).toBe(1);
    const flat = await visitor.get('/api/theories/flat-earth');
    expect(flat.json.imagePath).toMatch(/^\/api\/images\/[0-9a-f]{24}$/);
    expect(flat.json.imageCredit).toBe('Jane Doe · CC BY-SA 4.0 · Wikimedia Commons');
    expect(flat.json.images).toEqual([]); // cover only, not repeated in the gallery
    const img = await visitor.get(flat.json.imagePath);
    expect(img.status).toBe(200);
    expect(img.headers.get('Content-Type')).toBe('image/jpeg');
    expect((await visitor.get('/api/theories/hollow-earth')).json.imagePath).toBeNull();

    // An entry imported before images existed gets its cover in a later run.
    raw.prepare("UPDATE theories SET image_path = NULL, image_credit = NULL WHERE slug = 'flat-earth'").run();
    raw.prepare("UPDATE settings SET value = '2000-01-01T00:00:00.000Z' WHERE key = 'import.last_run'").run();
    const again = await visitor.post('/api/import/run');
    expect(again.json.images).toBe(1);
    expect((await visitor.get('/api/theories/flat-earth')).json.imagePath).toMatch(/^\/api\/images\//);
  });

  it('falls back to the Wikidata image and other free photos in the article, never to icons', async () => {
    const { visitor, raw } = await setup();
    fakeUpstream(
      [binding('Q50', 'Flat_Earth'), binding('Q60', 'Hollow_Earth'), binding('Q70', 'Lizard_People')],
      { 'en:Flat Earth': summary('Flat Earth'), 'en:Hollow Earth': summary('Hollow Earth'), 'en:Lizard People': summary('Lizard People') },
      [],
      {},
      {
        p18: { Q50: 'Globe photo.jpg' },
        pageFiles: { 'Hollow Earth': ['File:Commons-logo.svg', 'File:Flag of Atlantis.png', 'File:Hollow earth drawing.jpg'], 'Lizard People': ['File:Question book-new.svg'] },
        licenses: { 'File:Globe photo.jpg': 'CC0', 'File:Hollow earth drawing.jpg': 'Public domain', 'File:Flag of Atlantis.png': 'CC0' },
      },
    );
    const r = await visitor.post('/api/import/run');
    expect(r.json.images).toBe(2);
    const files = raw.prepare("SELECT title FROM sources WHERE publisher = 'Wikimedia Commons' ORDER BY id").all().map((x: any) => x.title);
    expect(files).toEqual(['File:Globe photo.jpg – Wikimedia Commons', 'File:Hollow earth drawing.jpg – Wikimedia Commons']);
    // No free image anywhere: the frontend shows the generated case-file cover.
    expect((await visitor.get('/api/theories/lizard-people')).json.imagePath).toBeNull();
  });

  it('recognises photos and rejects icons, logos and flags', () => {
    expect(isCoverCandidate('File:Paul McCartney 1966.jpg')).toBe(true);
    expect(isCoverCandidate('File:Commons-logo.svg')).toBe(false);
    expect(isCoverCandidate('File:Flag of Germany.png')).toBe(false);
    expect(isCoverCandidate('File:Diagram.svg')).toBe(false);
  });

  it('accepts only free licences', () => {
    expect(isFreeLicense('CC BY-SA 4.0', undefined)).toBe(true);
    expect(isFreeLicense('CC0', undefined)).toBe(true);
    expect(isFreeLicense('Public domain', undefined)).toBe(true);
    expect(isFreeLicense('Fair use', undefined)).toBe(false);
    expect(isFreeLicense('CC BY-SA 4.0', 'true')).toBe(false);
    expect(isFreeLicense(undefined, undefined)).toBe(false);
  });
});

describe('article details', () => {
  it('fills older imported entries from the full article in later runs and keeps every run below the subrequest limit', async () => {
    const { visitor, raw } = await setup();
    const many = Array.from({ length: 20 }, (_, i) => binding(`Q${i + 10}`, `Theory_${i}`));
    const pages = Object.fromEntries(many.map((_, i) => [`en:Theory ${i}`, summary(`Theory ${i}`)]));
    const calls = fakeUpstream(many, pages, [], Object.fromEntries(many.map((_, i) => [`Theory ${i}`, { file: `T${i}.jpg`, license: 'CC BY 4.0' }])));
    const first = await visitor.post('/api/import/run');
    expect(calls.length).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    expect(first.json.detailed).toBe(first.json.imported.length);
    // Simulate entries imported before details existed.
    raw.prepare("DELETE FROM claims WHERE theory_id IN (SELECT id FROM theories WHERE slug LIKE 'theory-%')").run();
    raw.prepare("UPDATE settings SET value = '2000-01-01T00:00:00.000Z' WHERE key = 'import.last_run'").run();
    calls.length = 0;
    const again = await visitor.post('/api/import/run');
    expect(calls.length).toBeLessThanOrEqual(MAX_SUBREQUESTS);
    expect(again.json.detailed).toBeGreaterThan(0);
    expect(raw.prepare("SELECT COUNT(DISTINCT c.theory_id) AS n FROM claims c JOIN theories t ON t.id = c.theory_id WHERE t.slug LIKE 'theory-%'").get().n).toBe(again.json.detailed);
  });

  it('uses the summary when the article text is missing, so the entry is not retried', async () => {
    const { visitor, raw } = await setup();
    fakeUpstream([binding('Q50', 'Flat_Earth')], { 'en:Flat Earth': summary('Flat Earth') }, [], {}, { articles: { 'Flat Earth': null } });
    const r = await visitor.post('/api/import/run');
    expect(r.json.detailed).toBe(1);
    expect(raw.prepare("SELECT c.text FROM claims c JOIN theories t ON t.id = c.theory_id WHERE t.slug = 'flat-earth'").all().map((c: any) => c.text)).toEqual(['Flat Earth is a conspiracy theory that has circulated widely.']);
  });

  it('takes claims from the article sentences when there is no claims section, never from criticism', () => {
    const d = articleDetails(
      [
        'X is a theory about the weather.',
        'Its proponents claim that clouds are made by machines.',
        '',
        '== Criticism of the claims ==',
        'Scientists say the claims are false and argue that clouds form naturally.',
        '',
        '== History ==',
        'It began in 1990.',
      ].join('\n'),
    );
    expect(d.claims).toEqual(['Its proponents claim that clouds are made by machines.']);
    expect(d.background).toBe('It began in 1990.');
    expect(d.sections.map((s) => s.heading)).toEqual(['Criticism of the claims']);
    expect(articleDetails('Y is a denial.\n\n== Examination of claims ==\nHistorians show that the claims are false.').claims).toEqual(['Y is a denial.']);
    expect(d.summary).toBe('X is a theory about the weather.\n\nIts proponents claim that clouds are made by machines.');
  });
});

describe('second source: Wikipedia list', () => {
  it('adds theory articles from the list after Wikidata, skipping people, places and duplicates', async () => {
    const { visitor } = await setup();
    const listPage = (title: string, qid: string, description?: string) => ({ title, description, pageprops: { wikibase_item: qid } });
    fakeUpstream(
      [binding('Q50', 'Flat_Earth')],
      {
        'en:Flat Earth': summary('Flat Earth'),
        'en:Bielefeld conspiracy': summary('Bielefeld conspiracy'),
        'en:Dundy County UFO hoax': summary('Dundy County UFO hoax'),
      },
      [
        [listPage('Flat Earth', 'Q50', 'Conspiracy theory'), listPage('Rudy Giuliani', 'Q1', 'American attorney and politician (born 1944)'), listPage('Bielefeld conspiracy', 'Q2', 'German satirical conspiracy theory')],
        [listPage('Hawaii', 'Q3', 'U.S. state'), listPage('Dundy County UFO hoax', 'Q4', '1884 American hoax')],
      ],
    );
    const r = await visitor.post('/api/import/run');
    expect(r.json.imported.map((i: any) => i.title)).toEqual(['Flat Earth', 'Bielefeld conspiracy', 'Dundy County UFO hoax']);
    expect(r.json.remaining).toBe(0);
  });

  it('still imports from Wikidata when the list is unavailable', async () => {
    const { visitor } = await setup();
    fakeUpstream([binding('Q50', 'Flat_Earth')], { 'en:Flat Earth': summary('Flat Earth') });
    const r = await visitor.post('/api/import/run');
    expect(r.status).toBe(200);
    expect(r.json.imported).toHaveLength(1);
  });

  it('recognises theory articles by their short description', () => {
    expect(isTheoryPage('Chemtrail conspiracy theory', 'Conspiracy theory about contrails')).toBe(true);
    expect(isTheoryPage('Holocaust denial', 'Denial of European Jewish genocide by Nazi Germany')).toBe(true);
    expect(isTheoryPage('Israel-related conspiracy theories', undefined)).toBe(true);
    expect(isTheoryPage('Alex Jones', 'American conspiracy theorist (born 1974)')).toBe(false);
    expect(isTheoryPage('Beyoncé', 'American singer and songwriter (born 1981)')).toBe(false);
    expect(isTheoryPage('Homeopathy', 'Pseudoscientific system of alternative medicine')).toBe(false);
    expect(isTheoryPage('Hindi cinema', undefined)).toBe(false);
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
