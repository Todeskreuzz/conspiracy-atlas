import { describe, expect, it } from 'vitest';
import { createDb } from './helpers/d1';
import {
  decideImport,
  duplicateHit,
  findDuplicateGroups,
  isClearTheory,
  matchKey,
  qidFromNote,
  titleSimilarity,
  topicVerdict,
  wikiUrlKey,
} from '../shared/import-match';

describe('import topic filter', () => {
  it('publishes conspiracy theories and holds hoaxes, denials and merely related topics', () => {
    expect(decideImport({ title: 'Chemtrail conspiracy theory', description: 'Conspiracy theory about contrails', listed: 'wikidata' })).toBe('publish');
    expect(decideImport({ title: 'Flat Earth', description: 'Flat Earth description', extract: 'Flat Earth is a conspiracy theory that has circulated widely.', listed: 'wikidata' })).toBe('publish');
    expect(decideImport({ title: 'Israel-related conspiracy theories', listed: 'clear' })).toBe('publish');
    expect(decideImport({ title: 'Blood libel', description: 'Antisemitic blood libel', listed: 'wikidata' })).toBe('publish');
    expect(decideImport({ title: 'Dundy County UFO hoax', description: '1884 American hoax', listed: 'ambiguous' })).toBe('review');
    expect(decideImport({ title: 'Holocaust denial', description: 'Denial of the genocide', listed: 'ambiguous' })).toBe('review');
    expect(decideImport({ title: 'Phantom time hypothesis', description: 'Historical hypothesis', extract: 'The phantom time hypothesis proposes that the early Middle Ages never occurred.', listed: 'wikidata' })).toBe('review');
    expect(decideImport({ title: 'September 11 attacks', description: '2001 terrorist attacks in the United States', extract: 'The September 11 attacks were four coordinated terrorist attacks.', listed: 'wikidata' })).toBe('reject');
    expect(decideImport({ title: 'Freemasonry', description: 'Fraternal organization mentioned in conspiracy theories', listed: 'wikidata' })).toBe('reject');
    expect(decideImport({ title: 'Alex Jones', description: 'American conspiracy theorist (born 1974)', listed: 'wikidata' })).toBe('reject');
    expect(decideImport({ title: 'List of conspiracy theories', description: 'Wikimedia list article', listed: 'wikidata' })).toBe('reject');
    expect(decideImport({ title: 'Conspiracy theory', description: 'Explanation that invokes a conspiracy', listed: 'wikidata' })).toBe('reject');
    expect(topicVerdict('Homeopathy', 'Pseudoscientific system of alternative medicine')).toBe('reject');
    expect(isClearTheory('New World Order', 'conspiracy theories related to a secret government')).toBe(true);
    expect(isClearTheory('Illuminati', 'related to conspiracy theories')).toBe(false);
  });
});

describe('import duplicate matching', () => {
  it('folds translations, redirects and aliases onto one key and flags near misses', () => {
    expect(matchKey('Chemtrail-Verschwörungstheorie')).toBe(matchKey('Chemtrail conspiracy theory'));
    expect(matchKey('Théorie du complot sur les alunissages')).toBe('alunissage');
    expect(matchKey('The Conspiracy')).toBe('');
    expect(wikiUrlKey('https://en.wikipedia.org/wiki/Moon_landing_hoax')).toBe('en.wikipedia.org/moon landing hoax');
    expect(wikiUrlKey('https://en.wikipedia.org/wiki/Moon_landing_hoax')).not.toBe(wikiUrlKey('https://de.wikipedia.org/wiki/Moon_landing_hoax'));
    expect(qidFromNote('import-review wikidata:Q42. Bitte prüfen.')).toBe('Q42');
    expect(qidFromNote('Imported automatically from Wikidata item Q50. Text licence: CC BY-SA 4.0.')).toBe('Q50');

    const known = [{ key: matchKey('Moon Landing Conspiracy Theory'), label: 'Moon Landing Conspiracy Theory' }];
    expect(duplicateHit([matchKey('Moon landing conspiracy theories')], [], known, new Set())?.level).toBe('exact');
    const fuzzy = duplicateHit([matchKey('Moon landing hoax')], [], known, new Set());
    expect(fuzzy).toMatchObject({ level: 'fuzzy', label: 'Moon Landing Conspiracy Theory' });
    expect(titleSimilarity(matchKey('Flat Earth'), matchKey('Hollow Earth'))).toBe(0);
    expect(titleSimilarity(matchKey('Pearl Harbor advance-knowledge conspiracy theory'), matchKey('9/11 advance-knowledge conspiracy theories'))).toBe(0);
    expect(duplicateHit([''], ['en.wikipedia.org/flat earth'], [], new Set(['en.wikipedia.org/flat earth']))?.level).toBe('exact');
  });

  it('reports duplicate groups and finds none in the seeded archive', () => {
    const groups = findDuplicateGroups([
      { id: 1, slug: 'moon', title: 'Moon Landing Conspiracy Theory', qid: 'Q1', titles: ['Moon Landing Conspiracy Theory', 'Verschwörungstheorie zur Mondlandung'], urls: ['https://en.wikipedia.org/wiki/Moon_landing_conspiracy_theories'] },
      { id: 2, slug: 'moon-2', title: 'Apollo hoax', qid: 'Q1', titles: ['Apollo hoax'], urls: [] },
      { id: 3, slug: 'chemtrail-claims', title: 'Chemtrail Claims', qid: null, titles: ['Chemtrail Claims'], urls: [] },
      { id: 4, slug: 'chemtrail-de', title: 'Chemtrail-Verschwörungstheorie', qid: 'Q2', titles: ['Chemtrail-Verschwörungstheorie'], urls: ['https://en.wikipedia.org/wiki/Chemtrail_conspiracy_theory'] },
      { id: 5, slug: 'other', title: 'Hollow Earth', qid: null, titles: ['Hollow Earth'], urls: [] },
    ]);
    expect(groups.find((g) => g.kind === 'qid')?.items.map((i) => i.slug).sort()).toEqual(['moon', 'moon-2']);
    expect(groups.find((g) => g.kind === 'title')?.items.map((i) => i.slug).sort()).toEqual(['chemtrail-claims', 'chemtrail-de']);
    expect(groups.some((g) => g.items.some((i) => i.slug === 'other'))).toBe(false);

    const db = createDb();
    const theories = db.raw.prepare('SELECT id, slug, title, wikidata_qid AS qid FROM theories').all() as { id: number; slug: string; title: string; qid: string | null }[];
    const translations = db.raw.prepare("SELECT entity_id, value FROM translations WHERE entity_type = 'theory' AND field = 'title'").all() as { entity_id: number; value: string }[];
    const byId = new Map(theories.map((t) => [t.id, { id: t.id, slug: t.slug, title: t.title, qid: t.qid, titles: [t.title], urls: [] as string[] }]));
    for (const tr of translations) byId.get(tr.entity_id)?.titles.push(tr.value);
    const seeded = findDuplicateGroups([...byId.values()]);
    expect(seeded.filter((g) => g.kind !== 'fuzzy')).toEqual([]);
  });

  it('does not report a similar title when the two cases are already linked', () => {
    const deep = { id: 45, slug: 'deep-state', title: 'Deep state', qid: null, titles: ['Deep state'], urls: [] };
    const turkey = { id: 50, slug: 'deep-state-in-turkey', title: 'Deep state in Turkey', qid: null, titles: ['Deep state in Turkey'], urls: [] };
    expect(findDuplicateGroups([deep, turkey]).some((g) => g.kind === 'fuzzy')).toBe(true);
    expect(findDuplicateGroups([deep, turkey], [[50, 45]]).filter((g) => g.kind === 'fuzzy')).toEqual([]);
  });
});
