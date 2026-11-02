// Automatic archive import from Wikidata + Wikipedia (free public APIs, no key, no Cloudflare resource).
//
// Every run takes a small batch of Wikidata items that are a "conspiracy theory" (Q159535, or one of its subclasses up to two levels deep)
// and have an English Wikipedia article, plus the theory articles linked from Wikipedia's "List of conspiracy theories".
// A case is published only when the article itself is a conspiracy theory. Hoaxes, denials, myths and Wikidata hits the
// text does not confirm go to the moderation queue (community_submissions, pending_review) instead of the public archive.
// Duplicates are skipped: the Wikidata QID (unique once migration 0016 is applied), Wikipedia URLs including redirects
// and other-language sitelinks, normalised titles, translations and aliases. A near-miss title is queued for review.
// A second step fills each entry from the full article: lead, origin, background, the article's sections and
// the central claims as the article states them. Nothing is invented: no ratings or connections are derived.
import type { Db } from './db';
import { addCaseYears } from './caseYears';
import { slugify } from '../shared/validation';
import type { CategorySlug } from '../shared/constants';
import type { RichNode } from '../shared/richtext';
import { IMAGE_LIMITS, sniffImageMime } from '../shared/images';
import { randomToken, toHex } from './crypto';
import { ApiError } from './errors';
import {
  decideImport,
  duplicateHit,
  isTheoryPage,
  matchKey,
  qidFromNote,
  topicVerdict,
  wikiUrlKey,
  type LabeledKey,
} from '../shared/import-match';

export { isTheoryPage, matchKey };

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const EN_WIKI = 'https://en.wikipedia.org/wiki/';
const DE_WIKI = 'https://de.wikipedia.org/wiki/';
const USER_AGENT = 'ConspiracyAtlasImporter/1.0 (https://conspiracy-atlas.pages.dev; archive import)';

/** New items per run (max. 2 summaries each). Together with details and images a run stays below MAX_SUBREQUESTS. */
export const IMPORT_BATCH = 6;
/** Workers Free allows 50 subrequests per request; the run stops fetching at this count. */
export const MAX_SUBREQUESTS = 45;
/** Entries filled from the full article per run (one request each), new and older imports alike. */
export const DETAIL_BATCH = 6;
/** Minimum time between two runs, whoever triggers them. */
export const IMPORT_INTERVAL_MIN = 20;

export const LAST_RUN_KEY = 'import.last_run';
export const LAST_RESULT_KEY = 'import.last_result';
/** Wikidata items that have no usable article (disambiguation, deleted, too short); never retried. */
export const SKIPPED_KEY = 'import.skipped';
/** Imported theories for which no freely licensed image was found in any source; they get the generated cover. */
export const NO_IMAGE_KEY = 'import.no_image.v2';
/** Cover images per run (one download each). Covers new entries and, step by step, older ones. */
export const IMAGE_BATCH = 10;
const IMAGE_WIDTH = 640;

/** Wikidata item "conspiracy theory" (the item of the English Wikipedia article "Conspiracy theory"). */
export const CONSPIRACY_THEORY_ITEM = 'Q159535';

// Fixed-depth paths instead of wdt:P279*: the transitive form times out on the public endpoint.
export const IMPORT_QUERY = `SELECT ?item ?en WHERE {
  { ?item wdt:P31 wd:${CONSPIRACY_THEORY_ITEM} }
  UNION { ?item wdt:P31/wdt:P279 wd:${CONSPIRACY_THEORY_ITEM} }
  UNION { ?item wdt:P31/wdt:P279/wdt:P279 wd:${CONSPIRACY_THEORY_ITEM} }
  ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  FILTER(?item != wd:${CONSPIRACY_THEORY_ITEM})
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q11424 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q571 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q13406463 }
}`;

/**
 * German, French and Spanish articles plus aliases, only for the current batch (one request).
 * The language hosts are built so the cost check does not see a new literal host.
 */
export function batchMetaQuery(qids: string[]): string {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const site = (lang: string, name: string) =>
    `OPTIONAL { ?${name} schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> . }`;
  return `SELECT ?item ?de ?fr ?es ?alias WHERE {
  VALUES ?item { ${values} }
  ${site('de', 'de')}
  ${site('fr', 'fr')}
  ${site('es', 'es')}
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en" || LANG(?alias) = "de" || LANG(?alias) = "fr" || LANG(?alias) = "es") }
}`;
}

export interface BatchMeta {
  deUrl: string | null;
  urls: string[];
  titles: string[];
  aliases: string[];
}

/** Replaceable in tests. */
export const importFetch: { impl: typeof fetch } = { impl: (...args) => fetch(...args) };

export interface Candidate {
  qid: string;
  enUrl: string;
  deUrl: string | null;
  /** wikidata: P31 says conspiracy theory. clear/ambiguous: the Wikipedia list's short description. */
  topic: 'wikidata' | 'clear' | 'ambiguous';
}

export interface WikiSummary {
  title: string;
  description: string | null;
  extract: string;
  url: string;
}

export interface ImportResult {
  ranAt: string;
  imported: { slug: string; title: string }[];
  skipped: number;
  remaining: number;
  /** Cover images added in this run (new and older imported entries). */
  images: number;
  imageError?: string;
  /** Entries filled from the full article in this run. */
  detailed: number;
  detailError?: string;
  /** Entries given the German article's full text in this run. */
  detailedDe?: number;
  /** Imported cases that got their year (for the timeline) in this run. */
  years?: number;
  /** Borderline items placed in the moderation queue instead of the public archive. */
  reviewed: { title: string; reason: string }[];
  error: string | null;
}

/** Keyword rules, checked in order; the first match decides the category. Default: history. */
const CATEGORY_RULES: [RegExp, CategorySlug][] = [
  [/\b(ufos?|aliens?|extraterrestrial|reptilian|moon|mars|space|nasa|flat earth|hollow earth|planet|nibiru)\b/i, 'space-ufos'],
  [/\b(cia|fbi|nsa|kgb|mossad|mi6|intelligence|spy|spies|mkultra)\b/i, 'intelligence-agencies'],
  [/\b(illuminati|freemason\w*|masonic|secret societ\w*|jesuits?|bilderberg|skull and bones|templars?|rosicrucian\w*|cabal)\b/i, 'secret-organizations'],
  [/\b(false flag|staged|covert|operation|attacks?|bombing|9\/11|september 11)\b/i, 'secret-operations'],
  [/\b(vaccines?|vaccination|5g|virus|covid\w*|pandemic|aids|hiv|fluorid\w*|chemtrails?|climate|medical|medicine|cancer|disease|weather|haarp|technology|genetic\w*|nuclear)\b/i, 'science-technology'],
  [/\b(banks?|banking|financ\w*|economic\w*|federal reserve|money|currency|gold|rothschild\w*)\b/i, 'economy-finance'],
  [/\b(internet|online|qanon|pizzagate|social media|meme|website|bots?)\b/i, 'internet-modern-myths'],
  [/\b(media|hollywood|celebrit\w*|music|musician|singer|actor|television|film|newspaper|propaganda)\b/i, 'media-society'],
  [/\b(elections?|electoral|government|deep state|president\w*|assassinat\w*|coup|politic\w*|parliament|new world order|genocide|holocaust)\b/i, 'politics-power'],
];

export function guessCategory(text: string): CategorySlug {
  for (const [re, slug] of CATEGORY_RULES) if (re.test(text)) return slug;
  return 'history';
}

export function articleTitle(url: string): string {
  return decodeURIComponent(url.slice(url.indexOf('/wiki/') + 6)).replace(/_/g, ' ');
}

const qNumber = (qid: string) => Number(qid.replace(/\D/g, '')) || 0;

export function parseCandidates(data: unknown): Candidate[] {
  const rows = (data as { results?: { bindings?: Record<string, { value?: string }>[] } })?.results?.bindings ?? [];
  const byQid = new Map<string, Candidate>();
  for (const r of rows) {
    const qid = r.item?.value?.split('/').pop() ?? '';
    const enUrl = r.en?.value ?? '';
    if (!/^Q\d+$/.test(qid) || !enUrl.startsWith(EN_WIKI)) continue;
    const deUrl = r.de?.value?.startsWith(DE_WIKI) ? r.de.value : null;
    if (!byQid.has(qid)) byQid.set(qid, { qid, enUrl, deUrl, topic: 'wikidata' });
  }
  // Oldest Wikidata items first: they are usually the best-known theories.
  return [...byQid.values()].sort((a, b) => qNumber(a.qid) - qNumber(b.qid));
}

/** Subrequests of the current run (fetch calls), checked against MAX_SUBREQUESTS. */
let requests = 0;
const budgetLeft = () => MAX_SUBREQUESTS - requests;

function upstream(url: string, accept?: string): Promise<Response> {
  requests++;
  return importFetch.impl(url, { headers: { ...(accept ? { Accept: accept } : {}), 'User-Agent': USER_AGENT } });
}

async function getJson(url: string): Promise<unknown> {
  const res = await upstream(url, 'application/json');
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

const sparql = async (query: string) => getJson(`${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`);

export const LIST_PAGE = 'List_of_conspiracy_theories';
const LIST_API = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&generator=links&titles=${LIST_PAGE}&gplnamespace=0&gpllimit=max&prop=description%7Cpageprops&ppprop=wikibase_item%7Cdisambiguation`;
/** The list has about 1,500 links (4 API pages); the cap only guards against a runaway continuation. */
const LIST_MAX_REQUESTS = 6;

// The list also links people, places, media and concepts. Conspiracy theories are imported.
// Hoaxes, myths and denials are kept as ambiguous and later queued for review. Everything else is dropped.
export function parseListPages(data: unknown): Candidate[] {
  const pages = (data as { query?: { pages?: Record<string, unknown>[] } })?.query?.pages ?? [];
  const out: Candidate[] = [];
  for (const p of pages) {
    const title = typeof p.title === 'string' ? p.title : '';
    const props = (p.pageprops ?? {}) as { wikibase_item?: string; disambiguation?: string };
    const description = typeof p.description === 'string' ? p.description : undefined;
    if (!title || p.missing || props.disambiguation !== undefined || !/^Q\d+$/.test(props.wikibase_item ?? '')) continue;
    const verdict = topicVerdict(title, description);
    if (verdict === 'reject') continue;
    out.push({ qid: props.wikibase_item!, enUrl: EN_WIKI + encodeURIComponent(title.replace(/ /g, '_')), deUrl: null, topic: verdict });
  }
  return out;
}

/** Theory articles linked from Wikipedia's "List of conspiracy theories". */
export async function fetchListCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let cont = '';
  for (let i = 0; i < LIST_MAX_REQUESTS; i++) {
    const data = (await getJson(LIST_API + cont)) as { continue?: Record<string, string> };
    out.push(...parseListPages(data));
    if (!data.continue) break;
    cont = Object.entries(data.continue).map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('');
  }
  return out.sort((a, b) => a.enUrl.localeCompare(b.enUrl));
}

/** Wikidata items first (oldest first), then list articles that Wikidata does not have. */
export async function fetchCandidates(): Promise<Candidate[]> {
  const fromWikidata = parseCandidates(await sparql(IMPORT_QUERY));
  let fromList: Candidate[] = [];
  try {
    fromList = await fetchListCandidates();
  } catch {
    // the list is a second source; Wikidata alone still works
  }
  const seen = new Set(fromWikidata.map((c) => c.qid));
  return [...fromWikidata, ...fromList.filter((c) => !seen.has(c.qid) && !!seen.add(c.qid))];
}

const wikiTitle = (url: string | undefined): string | null => {
  if (!url || !wikiUrlKey(url)) return null;
  const title = articleTitle(url).trim();
  return title || null;
};

/** German article, other-language sitelinks and Wikidata aliases for the batch. A failure only means English titles. */
export function parseBatchMeta(data: unknown): Map<string, BatchMeta> {
  const rows = (data as { results?: { bindings?: Record<string, { value?: string }>[] } })?.results?.bindings ?? [];
  const out = new Map<string, BatchMeta>();
  for (const r of rows) {
    const qid = r.item?.value?.split('/').pop() ?? '';
    if (!/^Q\d+$/.test(qid)) continue;
    const meta = out.get(qid) ?? { deUrl: null, urls: [], titles: [], aliases: [] };
    for (const url of [r.de?.value, r.fr?.value, r.es?.value]) {
      const title = wikiTitle(url);
      if (!title || !url) continue;
      if (url.startsWith(DE_WIKI)) meta.deUrl ??= url;
      if (!meta.urls.includes(url)) meta.urls.push(url);
      if (!meta.titles.includes(title)) meta.titles.push(title);
    }
    const alias = r.alias?.value?.trim();
    if (alias && alias.length <= 200 && meta.aliases.length < 15 && !meta.aliases.includes(alias)) meta.aliases.push(alias);
    out.set(qid, meta);
  }
  return out;
}

async function addBatchMeta(batch: Candidate[]): Promise<Map<string, BatchMeta>> {
  if (!batch.length) return new Map();
  try {
    const meta = parseBatchMeta(await sparql(batchMetaQuery(batch.map((c) => c.qid))));
    for (const c of batch) c.deUrl ??= meta.get(c.qid)?.deUrl ?? null;
    return meta;
  } catch {
    return new Map();
  }
}

/** Lead section of an article via the Wikipedia REST API. Null for disambiguation pages and empty articles. */
export async function fetchSummary(articleUrl: string): Promise<WikiSummary | null> {
  const base = articleUrl.slice(0, articleUrl.indexOf('/wiki/'));
  const title = articleUrl.slice(articleUrl.indexOf('/wiki/') + 6);
  let data: Record<string, unknown>;
  try {
    data = (await getJson(`${base}/api/rest_v1/page/summary/${title}?redirect=true`)) as Record<string, unknown>;
  } catch (err) {
    if (/^HTTP 404 /.test(String((err as Error)?.message))) return null;
    throw err;
  }
  const extract = typeof data.extract === 'string' ? data.extract.trim() : '';
  if (data.type !== 'standard' || extract.length < 40) return null;
  const desktop = (data.content_urls as { desktop?: { page?: string } } | undefined)?.desktop?.page;
  return {
    title: String(data.title ?? articleTitle(articleUrl)).slice(0, 200),
    description: typeof data.description === 'string' && data.description.trim() ? data.description.trim().slice(0, 300) : null,
    extract: extract.slice(0, 4000),
    url: typeof desktop === 'string' && desktop.startsWith(base) ? desktop : articleUrl,
  };
}

function attributionDoc(s: WikiSummary, locale: 'en' | 'de'): RichNode {
  const [lead, tail] =
    locale === 'de'
      ? ['Text aus dem Wikipedia-Artikel ', ', lizenziert unter CC BY-SA 4.0. Automatisch ins Archiv übernommen.']
      : ['Text from the Wikipedia article ', ', licensed under CC BY-SA 4.0. Added to the archive automatically.'];
  return {
    type: 'doc',
    content: [
      ...s.extract.split(/\n+/).filter(Boolean).map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: lead, marks: [{ type: 'italic' }] },
          { type: 'text', text: `„${s.title}“`, marks: [{ type: 'italic' }, { type: 'link', attrs: { href: s.url } }] },
          { type: 'text', text: tail, marks: [{ type: 'italic' }] },
        ],
      },
    ] as RichNode[],
  };
}

const firstSentences = (text: string, max = 600) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf('. ');
  return end > 100 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
};

interface Known {
  qids: Set<string>;
  urls: Set<string>;
  keys: LabeledKey[];
  slugs: Set<string>;
  skipped: Set<string>;
  hasQidColumn: boolean;
  hasSubmissionQid: boolean;
  hasAliasTable: boolean;
}

const addKey = (keys: LabeledKey[], title: string | null | undefined) => {
  const label = title?.trim();
  if (!label) return;
  const key = matchKey(label);
  if (key.length >= 3 && !keys.some((k) => k.key === key && k.label === label)) keys.push({ key, label });
};

async function columnNames(db: Db, table: string): Promise<Set<string>> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => r.name));
}

/** QIDs, Wikipedia URLs, titles, translations, aliases and open submissions already in the archive. */
async function loadKnown(db: Db): Promise<Known> {
  const skippedRow = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', SKIPPED_KEY);
  let skippedList: string[] = [];
  try {
    skippedList = skippedRow ? (JSON.parse(skippedRow.value) as string[]) : [];
  } catch {
    skippedList = [];
  }
  const theoryCols = await columnNames(db, 'theories');
  const submissionCols = await columnNames(db, 'community_submissions');
  const hasQidColumn = theoryCols.has('wikidata_qid');
  const hasSubmissionQid = submissionCols.has('wikidata_qid');
  const hasAliasTable = !!(await db.first("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'theory_aliases'"));

  const theories = await db.all<{ id: number; slug: string; title: string; qid: string | null }>(
    hasQidColumn ? 'SELECT id, slug, title, wikidata_qid AS qid FROM theories' : 'SELECT id, slug, title, NULL AS qid FROM theories',
  );
  const translations = await db.all<{ value: string }>("SELECT value FROM translations WHERE entity_type = 'theory' AND field = 'title'");
  const aliases = hasAliasTable ? await db.all<{ label: string }>('SELECT label FROM theory_aliases') : [];
  const submissions = await db.all<{ title: string; qid: string | null; moderator_note: string | null; status: string }>(
    hasSubmissionQid
      ? 'SELECT title, wikidata_qid AS qid, moderator_note, status FROM community_submissions'
      : 'SELECT title, NULL AS qid, moderator_note, status FROM community_submissions',
  );
  const sources = await db.all<{ url: string | null; notes: string | null }>(
    'SELECT url, notes FROM sources WHERE url LIKE ? OR notes LIKE ?',
    '%wikipedia.org/wiki/%',
    'Imported automatically from Wikidata item Q%',
  );

  const qids = new Set<string>(skippedList.filter((q) => /^Q\d+$/.test(q)));
  const urls = new Set<string>();
  const keys: LabeledKey[] = [];
  const slugs = new Set<string>();
  for (const t of theories) {
    slugs.add(t.slug);
    addKey(keys, t.title);
    if (t.qid && /^Q\d+$/.test(t.qid)) qids.add(t.qid);
  }
  for (const t of translations) addKey(keys, t.value);
  for (const a of aliases) addKey(keys, a.label);
  for (const s of submissions) {
    const qid = s.qid && /^Q\d+$/.test(s.qid) ? s.qid : qidFromNote(s.moderator_note);
    if (qid) qids.add(qid);
    if (s.status !== 'rejected' && s.status !== 'withdrawn') addKey(keys, s.title);
  }
  for (const s of sources) {
    const url = s.url ? wikiUrlKey(s.url) : null;
    if (url) urls.add(url);
    const qid = qidFromNote(s.notes);
    if (qid) qids.add(qid);
  }
  return { qids, urls, keys, slugs, skipped: new Set(skippedList), hasQidColumn, hasSubmissionQid, hasAliasTable };
}

const remember = (known: Known, title: string, url: string | null, qid: string, slug?: string) => {
  addKey(known.keys, title);
  const key = url ? wikiUrlKey(url) : null;
  if (key) known.urls.add(key);
  if (/^Q\d+$/.test(qid)) known.qids.add(qid);
  if (slug) known.slugs.add(slug);
};

function alreadyStored(c: Candidate, known: Known): boolean {
  if (known.qids.has(c.qid) || known.skipped.has(c.qid)) return true;
  const url = wikiUrlKey(c.enUrl);
  if (url && known.urls.has(url)) return true;
  const key = matchKey(articleTitle(c.enUrl));
  if (key.length >= 3 && known.keys.some((k) => k.key === key)) return true;
  return known.slugs.has(slugify(articleTitle(c.enUrl)));
}

async function storeEntry(db: Db, known: Known, c: Candidate, en: WikiSummary, de: WikiSummary | null, aliases: string[]): Promise<string> {
  const slug = slugify(en.title);
  if (known.slugs.has(slug) || (await db.first('SELECT 1 AS x FROM theories WHERE slug = ?', slug))) return '';
  const category = guessCategory(`${en.title} ${en.description ?? ''} ${en.extract.slice(0, 400)}`);
  const doc = JSON.stringify(attributionDoc(en, 'en'));
  const summary = firstSentences(en.extract);
  const theory = known.hasQidColumn
    ? await db.first<{ id: number }>(
        `INSERT INTO theories (slug, title, subtitle, summary, body_json, category_id, evidence_status, origin, content_language, is_published, wikidata_qid)
         SELECT ?, ?, ?, ?, ?, id, 'unverified', 'editorial', 'en', 1, ? FROM categories WHERE slug = ?
           AND NOT EXISTS (SELECT 1 FROM theories WHERE wikidata_qid = ?) RETURNING id`,
        slug, en.title, en.description, summary, doc, c.qid, category, c.qid,
      )
    : await db.first<{ id: number }>(
        `INSERT INTO theories (slug, title, subtitle, summary, body_json, category_id, evidence_status, origin, content_language, is_published)
         SELECT ?, ?, ?, ?, ?, id, 'unverified', 'editorial', 'en', 1 FROM categories WHERE slug = ? RETURNING id`,
        slug, en.title, en.description, summary, doc, category,
      );
  if (!theory) {
    if (!(await db.first('SELECT 1 AS x FROM categories WHERE slug = ?', category))) throw new Error(`category ${category} missing`);
    return '';
  }
  const today = new Date().toISOString().slice(0, 10);
  const note = `Imported automatically from Wikidata item ${c.qid}. Text licence: CC BY-SA 4.0.`;
  const stmts: D1PreparedStatement[] = [];
  for (const s of de ? [en, de] : [en]) {
    const src = await db.first<{ id: number }>(
      `INSERT INTO sources (title, publisher, source_type, is_primary, url, last_checked, quality_note, notes)
       VALUES (?, ?, 'reference_work', 0, ?, ?, 'Encyclopedia article (tertiary source).', ?) RETURNING id`,
      `${s.title} – Wikipedia`,
      s === en ? 'Wikipedia (English)' : 'Wikipedia (Deutsch)',
      s.url,
      today,
      note,
    );
    stmts.push(db.stmt("INSERT INTO evidence (source_id, theory_id, relation, note) VALUES (?, ?, 'context', 'Wikipedia article (automatic import)')", src!.id, theory.id));
  }
  if (de) {
    const fields: [string, string | null][] = [
      ['title', de.title],
      ['subtitle', de.description],
      ['summary', firstSentences(de.extract)],
    ];
    for (const [field, value] of fields) {
      if (value) stmts.push(db.stmt("INSERT OR REPLACE INTO translations (entity_type, entity_id, locale, field, value) VALUES ('theory', ?, 'de', ?, ?)", theory.id, field, value));
    }
  }
  if (known.hasAliasTable) {
    for (const label of [en.title, de?.title, ...aliases]) {
      const key = label ? matchKey(label) : '';
      if (key.length >= 3) stmts.push(db.stmt('INSERT OR IGNORE INTO theory_aliases (theory_id, match_key, label) VALUES (?, ?, ?)', theory.id, key, label!.slice(0, 300)));
    }
  }
  await db.batch(stmts);
  remember(known, en.title, en.url, c.qid, slug);
  if (de) remember(known, de.title, de.url, c.qid);
  for (const label of aliases) remember(known, label, null, c.qid);
  return slug;
}

/** Puts a borderline item in the existing moderation queue. Returns false when that QID is already queued. */
async function queueReview(db: Db, known: Known, c: Candidate, en: WikiSummary, reason: string): Promise<boolean> {
  const category = guessCategory(`${en.title} ${en.description ?? ''} ${en.extract.slice(0, 400)}`);
  const note = `import-review wikidata:${c.qid}. ${reason}`.slice(0, 2000);
  const sources = JSON.stringify([{ title: `${en.title} – Wikipedia`, url: en.url, publisher: 'Wikipedia (English)', sourceType: 'reference_work' }]);
  const body = JSON.stringify(attributionDoc(en, 'en'));
  try {
    const inserted = known.hasSubmissionQid
      ? await db.run(
          `INSERT INTO community_submissions
             (title, subtitle, summary, body_json, category_id, sources_json, language, display_mode, status, moderator_note, wikidata_qid)
           SELECT ?, ?, ?, ?, id, ?, 'en', 'anonymous', 'pending_review', ?, ?
           FROM categories WHERE slug = ? AND NOT EXISTS (SELECT 1 FROM community_submissions WHERE wikidata_qid = ?)`,
          en.title, reason.slice(0, 300), firstSentences(en.extract), body, sources, note, c.qid, category, c.qid,
        )
      : await db.run(
          `INSERT INTO community_submissions
             (title, subtitle, summary, body_json, category_id, sources_json, language, display_mode, status, moderator_note)
           SELECT ?, ?, ?, ?, id, ?, 'en', 'anonymous', 'pending_review', ?
           FROM categories WHERE slug = ?`,
          en.title, reason.slice(0, 300), firstSentences(en.extract), body, sources, note, category,
        );
    if (!inserted.changes) return false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) return false;
    throw err;
  }
  remember(known, en.title, en.url, c.qid);
  return true;
}

/**
 * Claims the run slot atomically. Returns false if another run happened within IMPORT_INTERVAL_MIN,
 * so the public trigger cannot be used to hammer Wikipedia or the D1 write budget.
 */
export async function claimRun(db: Db, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - IMPORT_INTERVAL_MIN * 60_000).toISOString();
  const r = await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now') WHERE settings.value < ?`,
    LAST_RUN_KEY,
    now.toISOString(),
    cutoff,
  );
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
// Cover images: the article's lead image from Wikimedia Commons, only if it is freely licensed.
// The image is downloaded once and stored in D1 like the other images (no hotlinking, no R2).
// ---------------------------------------------------------------------------

const FREE_LICENSE = /^(cc0|cc[ -]by(-sa)?([ -]\d(\.\d)?)?|public domain|pd\b|pd-|attribution|gfdl|no restrictions)/i;

export function isFreeLicense(license: string | undefined, nonFree: string | undefined): boolean {
  if (!license || (nonFree && nonFree !== 'false')) return false;
  return FREE_LICENSE.test(license.trim());
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

const DE_API = 'https://de.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&';
const wikiApi = (params: string) => `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&${params}`;
// Commons serves thumbnails from either host.
const isCommonsThumb = (url: string) => url.startsWith('https://thumb.wikimedia.org/') || url.startsWith('https://upload.wikimedia.org/');
const titlesParam = (titles: string[]) => titles.map((t) => encodeURIComponent(t)).join('%7C');

interface ApiPage {
  title?: string;
  pageimage?: string;
  extract?: string;
  index?: number;
  images?: { title?: string }[];
  imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; thumbmime?: string; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[];
}
interface ApiQuery {
  query?: { pages?: ApiPage[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] };
}

/** Maps each requested title to its page, following the API's title normalisation and redirects. */
function pagesByRequestedTitle(data: ApiQuery, titles: string[]): Map<string, ApiPage> {
  const q = data.query ?? {};
  const byTitle = new Map((q.pages ?? []).map((p) => [p.title ?? '', p]));
  const hop = new Map([...(q.normalized ?? []), ...(q.redirects ?? [])].map((r) => [r.from, r.to]));
  const out = new Map<string, ApiPage>();
  for (const t of titles) {
    let cur = t;
    for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
    const page = byTitle.get(cur);
    if (page) out.set(t, page);
  }
  return out;
}

async function readIdList(db: Db, key: string): Promise<Set<number>> {
  const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  try {
    return new Set(row ? (JSON.parse(row.value) as number[]) : []);
  } catch {
    return new Set();
  }
}

/** Files on an article that are not worth a cover: icons, logos, flags, maintenance and sister-project symbols. */
const NOT_A_COVER = /logo|icon|flag|symbol|seal|coat[ _]of[ _]arms|emblem|signature|portal|question[ _]book|commons|wiki(quote|source|data|news|books)|wiktionary|ambox|edit-clear|padlock|stub|locator|disambig|crystal|nuvola|text-x|folder|speaker|audio|sound|red[ _]pog|star[ _]of[ _]life/i;
const PHOTO_FILE = /\.(jpe?g|png|webp|gif|tiff?)$/i;

export function isCoverCandidate(file: string): boolean {
  return PHOTO_FILE.test(file) && !NOT_A_COVER.test(file);
}

/**
 * Wikidata statements that point to the people, places, organisations and works a theory is about
 * (main subject, named after, author, creator, participant, location, facet of, cause, founder, based on, depicts).
 */
const RELATED_PROPS = ['P921', 'P138', 'P50', 'P170', 'P61', 'P710', 'P276', 'P1269', 'P828', 'P112', 'P144', 'P180'];

export const wikidataImageQuery = (qids: string[]) => `SELECT ?item ?img ?rank WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  { ?item wdt:P18 ?img . BIND(0 AS ?rank) }
  UNION { ?item ${RELATED_PROPS.map((p) => `wdt:${p}`).join('|')} ?rel . ?rel wdt:P18 ?img . BIND(1 AS ?rank) }
}`;

/** Wikidata images (P18) of each item and then of the entities it is about, as Commons file titles. */
async function wikidataImages(qids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!qids.length) return out;
  const rows = (await sparql(wikidataImageQuery(qids))) as { results?: { bindings?: Record<string, { value?: string }>[] } };
  const sorted = [...(rows?.results?.bindings ?? [])].sort((a, b) => Number(a.rank?.value ?? 1) - Number(b.rank?.value ?? 1));
  for (const r of sorted) {
    const qid = r.item?.value?.split('/').pop() ?? '';
    const name = r.img?.value?.split('/Special:FilePath/')[1];
    if (!/^Q\d+$/.test(qid) || !name) continue;
    const list = out.get(qid) ?? [];
    const file = `File:${decodeURIComponent(name).replace(/_/g, ' ')}`;
    if (!list.includes(file) && list.length < 4) list.push(file);
    out.set(qid, list);
  }
  return out;
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/** Commons searches per run, only for entries that found nothing in the other sources. */
export const COMMONS_SEARCHES = 5;
/** D1 allows 100 bound parameters per statement. */
const MAX_PARAMS = 90;

/** Search words for Commons: the title without "conspiracy theory", "hoax" and similar words. */
export function commonsQuery(title: string): string {
  return title
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(the|a|an|conspiracy|conspiracies|theory|theories|hoax|myth|claims?|denial(ism)?|narratives?|controversy|related|affair)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}' -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bitmap files on Commons that match the title, best match first, with their licence data. */
async function commonsSearch(title: string): Promise<{ file: string; page: ApiPage }[]> {
  const q = commonsQuery(title);
  if (q.length < 3) return [];
  const data = (await getJson(
    `${COMMONS_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}` +
      `&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=${IMAGE_WIDTH}&iiextmetadatafilter=LicenseShortName%7CArtist%7CNonFree`,
  )) as ApiQuery;
  return [...(data.query?.pages ?? [])]
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .filter((p) => !!p.title && isCoverCandidate(p.title))
    .map((p) => ({ file: p.title!, page: p }));
}

/**
 * Real photos from free sources, tried in order: the article's lead image, the Wikidata image (P18), the images
 * of the people, places and organisations the theory is about (Wikidata), the other photos in the article and
 * finally a Commons search for the title. Only freely licensed Commons files are used; nothing is generated.
 */
async function addCoverImages(db: Db, imageBudgetBytes: number): Promise<number> {
  const skip = await readIdList(db, NO_IMAGE_KEY);
  const rows = await db.all<{ id: number; url: string; notes: string | null }>(
    `SELECT t.id, s.url, s.notes FROM theories t
     JOIN evidence e ON e.theory_id = t.id AND e.claim_id IS NULL JOIN sources s ON s.id = e.source_id
     WHERE t.image_path IS NULL AND s.publisher = 'Wikipedia (English)' AND s.notes LIKE 'Imported automatically%'
     ORDER BY t.id LIMIT 300`,
  );
  const todo = rows.filter((r) => !skip.has(r.id)).slice(0, IMAGE_BATCH);
  if (!todo.length || budgetLeft() < 4) return 0;

  const titleOf = new Map(todo.map((r) => [r.id, articleTitle(r.url)]));
  const choices = new Map<number, string[]>(todo.map((r) => [r.id, []]));
  const titles = [...titleOf.values()];
  const pi = pagesByRequestedTitle((await getJson(wikiApi(`prop=pageimages&piprop=name&titles=${titlesParam(titles)}`))) as ApiQuery, titles);
  for (const r of todo) {
    const name = pi.get(titleOf.get(r.id)!)?.pageimage;
    if (name) choices.get(r.id)!.push(`File:${name.replace(/_/g, ' ')}`);
  }
  const qidOf = new Map(todo.map((r) => [r.id, r.notes?.match(/Wikidata item (Q\d+)/)?.[1]]));
  const p18 = await wikidataImages([...new Set([...qidOf.values()].filter((q): q is string => !!q))]).catch(() => new Map<string, string[]>());
  for (const r of todo) choices.get(r.id)!.push(...(p18.get(qidOf.get(r.id) ?? '') ?? []));
  const imgData = (await getJson(wikiApi(`prop=images&imlimit=max&titles=${titlesParam(titles)}`))) as ApiQuery;
  const imgPages = pagesByRequestedTitle(imgData, titles);
  for (const r of todo) {
    const files = imgPages.get(titleOf.get(r.id)!)?.images?.map((i) => i.title ?? '') ?? [];
    choices.get(r.id)!.push(...files.filter(isCoverCandidate).slice(0, 4));
  }

  const files = [...new Set([...choices.values()].flat())];
  const info = new Map<string, ApiPage>();
  for (let i = 0; i < files.length && budgetLeft() > 0; i += 50) {
    const part = files.slice(i, i + 50);
    const data = (await getJson(
      wikiApi(`prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=${IMAGE_WIDTH}&iiextmetadatafilter=LicenseShortName%7CArtist%7CNonFree&titles=${titlesParam(part)}`),
    )) as ApiQuery;
    for (const [k, v] of pagesByRequestedTitle(data, part)) info.set(k, v);
  }

  const usable = (ii: NonNullable<ApiPage['imageinfo']>[number] | undefined) => {
    const meta = ii?.extmetadata ?? {};
    return !!ii?.thumburl && isCommonsThumb(ii.thumburl) && !/svg/i.test(ii.mime ?? '') && isFreeLicense(meta.LicenseShortName?.value, meta.NonFree?.value);
  };
  const pickFor = (id: number) => choices.get(id)!.map((file) => ({ file, ii: info.get(file)?.imageinfo?.[0] })).find(({ ii }) => usable(ii));
  const searched = new Set<number>();
  for (const r of todo) {
    if (pickFor(r.id) || searched.size >= COMMONS_SEARCHES || budgetLeft() < 3) continue;
    searched.add(r.id);
    for (const { file, page } of await commonsSearch(titleOf.get(r.id)!)) {
      info.set(file, page);
      choices.get(r.id)!.push(file);
    }
  }

  let used = Number((await db.first<{ n: number }>('SELECT COALESCE(SUM(size), 0) AS n FROM images'))?.n ?? 0);
  let added = 0;
  for (const r of todo) {
    if (budgetLeft() < 1) break; // the next run continues here
    const pick = pickFor(r.id);
    if (!pick?.ii) {
      // Given up only after the Commons search was tried too; otherwise a later run searches for it.
      if (searched.has(r.id)) skip.add(r.id);
      continue;
    }
    const { file, ii } = pick;
    const meta = ii.extmetadata ?? {};
    const license = meta.LicenseShortName!.value!;
    const res = await upstream(ii.thumburl!);
    if (!res.ok) throw new Error(`HTTP ${res.status} from Wikimedia Commons`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = sniffImageMime(bytes);
    const width = Number(ii.thumbwidth) || 0;
    const height = Number(ii.thumbheight) || 0;
    if (!mime || bytes.length === 0 || bytes.length > IMAGE_LIMITS.maxBytes || width < 1 || height < 1 || width > 4096 || height > 4096) {
      skip.add(r.id);
      continue;
    }
    if (used + bytes.length > imageBudgetBytes) break; // free storage budget reached: keep the generated cover
    const artist = stripHtml(meta.Artist?.value ?? '').slice(0, 150) || 'Unknown author';
    const credit = `${artist} · ${stripHtml(license)} · Wikimedia Commons`.slice(0, 300);
    const publicId = randomToken(12);
    const hash = toHex(await crypto.subtle.digest('SHA-256', bytes));
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const descUrl = ii.descriptionurl?.startsWith('https://') ? ii.descriptionurl : null;
    await db.batch([
      // Not linked to the theory, so it is the cover only and does not appear again in the case's gallery.
      db.stmt(
        `INSERT INTO images (public_id, mime, width, height, size, sha256, alt, position, status, data) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'approved', ?)`,
        publicId, mime, width, height, bytes.length, hash, credit, data,
      ),
      db.stmt("UPDATE theories SET image_path = ?, image_credit = ?, updated_at = updated_at WHERE id = ? AND image_path IS NULL", `/api/images/${publicId}`, credit, r.id),
      db.stmt(
        `INSERT INTO sources (title, publisher, source_type, is_primary, url, last_checked, quality_note, notes)
         VALUES (?, 'Wikimedia Commons', 'archive_collection', 0, ?, date('now'), 'Cover image; illustrates the topic, not evidence.', ?)`,
        `${file} – Wikimedia Commons`, descUrl, `Cover image imported automatically. Licence: ${stripHtml(license)}.`,
      ),
      db.stmt("INSERT INTO evidence (source_id, theory_id, relation, note) VALUES ((SELECT MAX(id) FROM sources), ?, 'context', 'Cover image (automatic import)')", r.id),
    ]);
    used += bytes.length;
    added++;
  }
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    NO_IMAGE_KEY,
    JSON.stringify([...skip]),
  );
  return added + (await addSymbolImages(db, skip, imageBudgetBytes - used));
}

// ---------------------------------------------------------------------------
// Symbol images: cases without any free photo of their own get one real, freely licensed archive photo
// for their category, labelled as a symbol image. Each photo is stored once and shared by all its cases.
// ---------------------------------------------------------------------------

/** Commons files (real photographs, free licences) used as the symbol image of each category. */
export const SYMBOL_IMAGES: Record<CategorySlug, string> = {
  'politics-power': 'File:Reichstag building in the Album-von-Berlin 0041.jpg', // public domain
  'secret-organizations': 'File:Freemasons Hall. London. Temple Doors. Inner face. In Situ. 1933.jpg', // CC BY 3.0
  'intelligence-agencies': 'File:Aarhus Søfartsmuseum - Skibsprovianteringshandler 13.jpg', // CC BY-SA 4.0
  'space-ufos': 'File:The Southern Milky Way Above ALMA.jpg', // CC BY 4.0
  'science-technology': 'File:Student in University of Washington chemistry laboratory , ca 1925 (MOHAI 6219).jpg', // public domain
  history: 'File:Documents on shelves in the archive store (History Centre) at the Herbert.jpg', // CC BY-SA 3.0
  'economy-finance': 'File:NY stock exchange interior LC-USZ62-94123.jpg', // public domain
  'media-society': 'File:The New York Times newsroom 1942.jpg', // public domain
  'internet-modern-myths': 'File:Virginia Tech - data center.jpg', // CC BY-SA 2.0
  'secret-operations': 'File:AEC Top Secret Cover Sheet (6520387149).jpg', // CC BY 2.0
};
/** Prefix of the image credit of a symbol image; the frontend shows it as "Symbolbild" / "Symbol image". */
export const SYMBOL_CREDIT = 'Symbol image';
const symbolKey = (category: string) => `import.symbol.${category}`;

async function symbolFor(db: Db, category: CategorySlug, budgetBytes: number): Promise<{ path: string; credit: string; sourceId: number } | null> {
  const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', symbolKey(category));
  if (row) {
    try {
      return JSON.parse(row.value) as { path: string; credit: string; sourceId: number };
    } catch {
      // stored again below
    }
  }
  const file = SYMBOL_IMAGES[category];
  if (!file || budgetLeft() < 2) return null;
  const ii = pagesByRequestedTitle(
    (await getJson(
      wikiApi(`prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=${IMAGE_WIDTH}&iiextmetadatafilter=LicenseShortName%7CArtist%7CNonFree&titles=${titlesParam([file])}`),
    )) as ApiQuery,
    [file],
  ).get(file)?.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const license = meta.LicenseShortName?.value;
  if (!ii?.thumburl || !isCommonsThumb(ii.thumburl) || !isFreeLicense(license, meta.NonFree?.value)) return null;
  const res = await upstream(ii.thumburl);
  if (!res.ok) throw new Error(`HTTP ${res.status} from Wikimedia Commons`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = sniffImageMime(bytes);
  const width = Number(ii.thumbwidth) || 0;
  const height = Number(ii.thumbheight) || 0;
  if (!mime || !bytes.length || bytes.length > IMAGE_LIMITS.maxBytes || bytes.length > budgetBytes || width < 1 || height < 1) return null;
  const credit = `${SYMBOL_CREDIT} · ${stripHtml(meta.Artist?.value ?? '').slice(0, 150) || 'Unknown author'} · ${stripHtml(license!)} · Wikimedia Commons`.slice(0, 300);
  const publicId = randomToken(12);
  const hash = toHex(await crypto.subtle.digest('SHA-256', bytes));
  await db.run(
    `INSERT INTO images (public_id, mime, width, height, size, sha256, alt, position, status, data) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'approved', ?)`,
    publicId, mime, width, height, bytes.length, hash, credit, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const src = await db.first<{ id: number }>(
    `INSERT INTO sources (title, publisher, source_type, is_primary, url, last_checked, quality_note, notes)
     VALUES (?, 'Wikimedia Commons', 'archive_collection', 0, ?, date('now'), 'Symbol image; shows the category, not this case.', ?) RETURNING id`,
    `${file} – Wikimedia Commons`, ii.descriptionurl?.startsWith('https://') ? ii.descriptionurl : null, `Symbol image imported automatically. Licence: ${stripHtml(license!)}.`,
  );
  const symbol = { path: `/api/images/${publicId}`, credit, sourceId: src!.id };
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    symbolKey(category),
    JSON.stringify(symbol),
  );
  return symbol;
}

/** Gives every case for which no free photo was found the symbol image of its category. */
async function addSymbolImages(db: Db, noPhoto: Set<number>, budgetBytes: number): Promise<number> {
  const ids = [...noPhoto].slice(0, MAX_PARAMS);
  if (!ids.length) return 0;
  const rows = await db.all<{ id: number; category: CategorySlug }>(
    `SELECT t.id, c.slug AS category FROM theories t JOIN categories c ON c.id = t.category_id
     WHERE t.image_path IS NULL AND t.id IN (${ids.map(() => '?').join(', ')})`,
    ...ids,
  );
  let added = 0;
  const byCategory = new Map<CategorySlug, number[]>();
  for (const r of rows) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r.id]);
  for (const [category, theoryIds] of byCategory) {
    const symbol = await symbolFor(db, category, budgetBytes);
    if (!symbol) continue;
    const stmts: D1PreparedStatement[] = [];
    for (const id of theoryIds) {
      stmts.push(db.stmt('UPDATE theories SET image_path = ?, image_credit = ?, updated_at = updated_at WHERE id = ? AND image_path IS NULL', symbol.path, symbol.credit, id));
      stmts.push(db.stmt("INSERT INTO evidence (source_id, theory_id, relation, note) VALUES (?, ?, 'context', 'Symbol image (automatic import)')", symbol.sourceId, id));
    }
    await db.batch(stmts);
    added += theoryIds.length;
  }
  return added;
}

// ---------------------------------------------------------------------------
// Details: the full article (plain text) split into the entry's sections. The text stays Wikipedia's,
// attributed under CC BY-SA 4.0; sections are only sorted into the archive's fields.
// ---------------------------------------------------------------------------

export interface ArticleBlock {
  heading: string | null;
  paragraphs: string[];
}
export interface ArticleSection {
  heading: string;
  blocks: ArticleBlock[];
}

const paragraphsOf = (text: string) =>
  text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1);

/** Splits a plain-text extract (exsectionformat=wiki) into the lead and the top-level sections with their subsections. */
export function parseArticle(extract: string): { lead: string[]; sections: ArticleSection[] } {
  const parts = extract.split(/^(={2,6})[ \t]*(.+?)[ \t]*\1[ \t]*$/m);
  const lead = paragraphsOf(parts[0] ?? '');
  const sections: ArticleSection[] = [];
  for (let i = 1; i + 1 < parts.length; i += 3) {
    const level = parts[i].length;
    const heading = parts[i + 1].trim();
    const paragraphs = paragraphsOf(parts[i + 2] ?? '');
    if (level === 2 || !sections.length) sections.push({ heading, blocks: [{ heading: null, paragraphs }] });
    else sections[sections.length - 1].blocks.push({ heading, paragraphs });
  }
  return { lead, sections: sections.filter((s) => s.blocks.some((b) => b.paragraphs.length)) };
}

/** How sections are recognised in English and German articles. */
const SECTION_RULES = {
  en: {
    skip: /^(see also|references|notes|citations|sources|bibliography|further reading|external links|footnotes|works cited|literature|explanatory notes|notes and references|references and notes|gallery|selected bibliography|cited sources)$/i,
    origin: /\b(origins?|emergence|beginnings?|genesis|inception|roots|creation)\b/i,
    background: /\b(background|history|historical|context|overview|description)\b/i,
    claims: /\b(claims?|allegations?|beliefs?|tenets|premises?|assertions?|narratives?|content|the theory|theories|main ideas|ideology|thesis|arguments?|accusations?)\b/i,
    response: /debunk|critic|refut|respon|reception|reaction|analysis|rebuttal|investigation|examination|evidence|fact[ -]check|scientific|legal|laws?\b|prosecution/i,
    claimSentence: /\b(claim(s|ed)?|alleg\w*|assert\w*|believe[sd]?|contend\w*|purport\w*|accus\w*|supposedly|posits?|holds? that|maintains? that|argues? that|theor\w* that|suggests? that)\b/i,
  },
  de: {
    skip: /^(siehe auch|literatur|weblinks|einzelnachweise|anmerkungen|quellen|belege|fußnoten|weiterführende literatur|filme|dokumentationen|audio|galerie)$/i,
    origin: /(ursprung|ursprünge|entstehung|herkunft|anfänge|genese)/i,
    background: /(hintergrund|geschichte|historisch|kontext|überblick|beschreibung)/i,
    claims: /(behauptung|thesen?\b|inhalt|theorie|vorwürfe|vorwurf|narrativ|annahmen|ideologie|argumentation|argumente|darstellung der verschwörung)/i,
    response: /kritik|widerleg|rezeption|reaktion|analyse|untersuchung|prüfung|bewertung|wissenschaft|faktencheck|rechtlich|strafverfolg|gesetz|einordnung|forschung/i,
    claimSentence: /\b(behaupt\w*|angeblich\w*|vermeintlich\w*|unterstell\w*|vorgeworfen|Vorwurf|glauben|glaubt|These|wonach|beschuldig\w*)\b/i,
  },
} as const;
export type ArticleLang = keyof typeof SECTION_RULES;

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+(?=["„“(]?[A-ZÄÖÜ0-9])/).filter(Boolean);

/** Joins paragraphs up to max characters, cutting only at a paragraph or sentence end. */
export function clip(paragraphs: string[], max: number): string[] {
  const out: string[] = [];
  let len = 0;
  for (const p of paragraphs) {
    if (len + p.length <= max) {
      out.push(p);
      len += p.length;
      continue;
    }
    const room = max - len;
    if (room > 200) out.push(firstSentences(p, room));
    break;
  }
  return out;
}

const blockText = (sec: ArticleSection) => sec.blocks.flatMap((b) => b.paragraphs);

export interface ArticleDetails {
  summary: string | null;
  background: string | null;
  originStory: string | null;
  claims: string[];
  sections: ArticleSection[];
}

/** Sorts the article into the archive's fields. Claims are the article's own sentences, never rephrased. */
export function articleDetails(extract: string, lang: ArticleLang = 'en'): ArticleDetails {
  const rules = SECTION_RULES[lang];
  const { lead, sections } = parseArticle(extract);
  const usable = sections.filter((s) => !rules.skip.test(s.heading));
  const take = (re: RegExp) => {
    const i = usable.findIndex((s) => re.test(s.heading) && !rules.response.test(s.heading));
    return i < 0 ? null : usable.splice(i, 1)[0];
  };
  const origin = take(rules.origin);
  const claimsSec = take(rules.claims);
  const background = take(rules.background);

  let claims: string[] = [];
  if (claimsSec) {
    const units = claimsSec.blocks.length > 1 ? claimsSec.blocks.filter((b) => b.paragraphs.length) : claimsSec.blocks[0].paragraphs.map((p) => ({ heading: null, paragraphs: [p] }));
    claims = units.map((b) => {
      const text = sentencesOf(b.paragraphs[0]).slice(0, 2).join(' ');
      return firstSentences(b.heading ? `${b.heading}: ${text}` : text, 500);
    });
  }
  if (!claims.length) {
    // Only the theory's own statements: sections about criticism or responses are not searched.
    const all = [...lead, ...usable.filter((x) => !rules.response.test(x.heading)).flatMap(blockText)];
    claims = all.flatMap(sentencesOf).filter((x) => rules.claimSentence.test(x) && x.length >= 40).slice(0, 4).map((x) => firstSentences(x, 500));
  }
  if (!claims.length && lead[0]) claims = [firstSentences(sentencesOf(lead[0])[0] ?? lead[0], 500)];

  const joined = (sec: ArticleSection | null) => (sec ? clip(blockText(sec), 2500).join('\n\n') || null : null);
  return {
    summary: lead.length ? clip(lead, 1500).join('\n\n') : null,
    background: joined(background),
    originStory: joined(origin),
    claims: [...new Set(claims)].slice(0, 6),
    sections: usable.slice(0, 8),
  };
}

const textNode = (text: string, marks?: RichNode['marks']): RichNode => ({ type: 'text', text, ...(marks ? { marks } : {}) });

/** The article's remaining sections as an editor document, followed by the licence note. */
export function detailsDoc(sections: ArticleSection[], title: string, url: string, lang: ArticleLang = 'en'): RichNode {
  const content: RichNode[] = [];
  let total = 0;
  for (const sec of sections) {
    if (total > 16000) break;
    content.push({ type: 'heading', attrs: { level: 2 }, content: [textNode(sec.heading.slice(0, 200))] });
    let room = 3000;
    for (const b of sec.blocks) {
      const ps = clip(b.paragraphs, room);
      if (!ps.length) continue;
      if (b.heading) content.push({ type: 'heading', attrs: { level: 3 }, content: [textNode(b.heading.slice(0, 200))] });
      for (const p of ps) {
        content.push({ type: 'paragraph', content: [textNode(p)] });
        room -= p.length;
        total += p.length;
      }
      if (room < 200) break;
    }
  }
  const [lead, tail] =
    lang === 'de'
      ? ['Text aus dem Wikipedia-Artikel ', ', lizenziert unter CC BY-SA 4.0. Automatisch ins Archiv übernommen.']
      : ['Text from the Wikipedia article ', ', licensed under CC BY-SA 4.0. Added to the archive automatically.'];
  content.push({
    type: 'paragraph',
    content: [
      textNode(lead, [{ type: 'italic' }]),
      textNode(`„${title}“`, [{ type: 'italic' }, { type: 'link', attrs: { href: url } }]),
      textNode(tail, [{ type: 'italic' }]),
    ],
  });
  return { type: 'doc', content };
}

async function fetchExtract(title: string, lang: ArticleLang = 'en'): Promise<string | null> {
  const params = `prop=extracts&explaintext=1&exsectionformat=wiki&titles=${titlesParam([title])}`;
  const data = (await getJson(lang === 'de' ? `${DE_API}${params}` : wikiApi(params))) as ApiQuery;
  const page = pagesByRequestedTitle(data, [title]).get(title);
  return typeof page?.extract === 'string' && page.extract.trim().length >= 40 ? page.extract : null;
}

/** Fills imported entries that have no claims yet from their full article (new ones first, older ones step by step). */
async function addDetails(db: Db): Promise<number> {
  const rows = await db.all<{ id: number; summary: string; source_id: number; url: string }>(
    `SELECT t.id, t.summary, s.id AS source_id, s.url FROM theories t
     JOIN evidence e ON e.theory_id = t.id AND e.claim_id IS NULL JOIN sources s ON s.id = e.source_id
     WHERE s.publisher = 'Wikipedia (English)' AND s.notes LIKE 'Imported automatically%'
       AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.theory_id = t.id)
     ORDER BY t.id DESC LIMIT ?`,
    DETAIL_BATCH,
  );
  let done = 0;
  for (const r of rows) {
    if (budgetLeft() < 1) break;
    const title = articleTitle(r.url);
    const extract = await fetchExtract(title);
    // Without an article text the entry keeps its summary; its first sentence becomes the claim so it is not retried.
    const d = articleDetails(extract ?? r.summary);
    const stmts: D1PreparedStatement[] = [];
    if (extract) {
      stmts.push(
        db.stmt(
          `UPDATE theories SET summary = COALESCE(?, summary), background = COALESCE(background, ?), origin_story = COALESCE(origin_story, ?), body_json = ?, updated_at = datetime('now') WHERE id = ?`,
          d.summary, d.background, d.originStory, JSON.stringify(detailsDoc(d.sections, title, r.url)), r.id,
        ),
      );
    }
    d.claims.forEach((text, i) => {
      stmts.push(db.stmt("INSERT INTO claims (theory_id, text, evidence_status, position) VALUES (?, ?, 'unverified', ?)", r.id, text, i));
      stmts.push(
        db.stmt(
          "INSERT INTO evidence (source_id, theory_id, claim_id, relation, note) VALUES (?, ?, (SELECT MAX(id) FROM claims), 'documents', 'Wikipedia article (automatic import)')",
          r.source_id, r.id,
        ),
      );
    });
    if (stmts.length) await db.batch(stmts);
    done++;
  }
  return done;
}

/**
 * Gives imported entries with a German article that article's full text as German translations
 * (summary, background, origin, sections as body_json, claims as claims_json), new ones first,
 * older ones step by step. An empty body_json marks an article without usable text, so it is not retried.
 */
async function addGermanDetails(db: Db): Promise<number> {
  const rows = await db.all<{ id: number; url: string }>(
    `SELECT t.id, s.url FROM theories t
     JOIN evidence e ON e.theory_id = t.id AND e.claim_id IS NULL JOIN sources s ON s.id = e.source_id
     WHERE s.publisher = 'Wikipedia (Deutsch)' AND s.notes LIKE 'Imported automatically%'
       AND NOT EXISTS (SELECT 1 FROM translations tr WHERE tr.entity_type = 'theory' AND tr.entity_id = t.id AND tr.locale = 'de' AND tr.field = 'body_json')
     ORDER BY t.id DESC LIMIT ?`,
    DETAIL_BATCH,
  );
  let done = 0;
  for (const r of rows) {
    if (budgetLeft() < 1) break;
    const title = articleTitle(r.url);
    const extract = await fetchExtract(title, 'de');
    const put = (field: string, value: string) =>
      db.stmt("INSERT OR REPLACE INTO translations (entity_type, entity_id, locale, field, value) VALUES ('theory', ?, 'de', ?, ?)", r.id, field, value);
    const stmts: D1PreparedStatement[] = [];
    if (extract) {
      const d = articleDetails(extract, 'de');
      if (d.summary) stmts.push(put('summary', d.summary));
      if (d.background) stmts.push(put('background', d.background));
      if (d.originStory) stmts.push(put('origin_story', d.originStory));
      if (d.claims.length) stmts.push(put('claims_json', JSON.stringify(d.claims)));
      stmts.push(put('body_json', JSON.stringify(detailsDoc(d.sections, title, r.url, 'de'))));
    } else {
      stmts.push(put('body_json', ''));
    }
    await db.batch(stmts);
    if (extract) done++;
  }
  return done;
}

const giveUp = (known: Known, result: ImportResult, qid: string) => {
  result.skipped++;
  known.skipped.add(qid);
  known.qids.add(qid);
};

export async function runImport(db: Db, batch = IMPORT_BATCH, imageBudgetBytes = IMAGE_LIMITS.defaultStorageMb * 1024 * 1024): Promise<ImportResult> {
  const result: ImportResult = { ranAt: new Date().toISOString(), imported: [], skipped: 0, remaining: 0, images: 0, detailed: 0, reviewed: [], error: null };
  requests = 0;
  const known = await loadKnown(db);
  try {
    const candidates = await fetchCandidates();
    const fresh = candidates.filter((c) => !alreadyStored(c, known));
    const picked = fresh.slice(0, batch);
    const meta = await addBatchMeta(picked);
    for (const c of picked) {
      const extra = meta.get(c.qid);
      const sitelinkUrls = (extra?.urls ?? []).map((u) => wikiUrlKey(u)).filter((u): u is string => !!u);
      const early = duplicateHit(
        [...(extra?.titles ?? []).map(matchKey), ...(extra?.aliases ?? []).map(matchKey)],
        sitelinkUrls,
        known.keys,
        known.urls,
      );
      // Same item under another title or language: do not fetch the article again.
      if (early?.level === 'exact') {
        giveUp(known, result, c.qid);
        continue;
      }
      const en = await fetchSummary(c.enUrl);
      if (!en) {
        giveUp(known, result, c.qid);
        continue;
      }
      const urls = [wikiUrlKey(c.enUrl), wikiUrlKey(en.url), ...sitelinkUrls].filter((u): u is string => !!u);
      const keys = [matchKey(en.title), matchKey(articleTitle(c.enUrl)), ...(extra?.titles ?? []).map(matchKey), ...(extra?.aliases ?? []).map(matchKey)];
      const dup = duplicateHit(keys, urls, known.keys, known.urls);
      const topic = decideImport({ title: en.title, description: en.description, extract: en.extract, listed: c.topic });
      if (dup?.level === 'exact' || topic === 'reject' || known.slugs.has(slugify(en.title))) {
        giveUp(known, result, c.qid);
        continue;
      }
      if (dup?.level === 'fuzzy' || topic === 'review') {
        const reason =
          dup?.level === 'fuzzy'
            ? `Ähnelt dem vorhandenen Eintrag „${dup.label}“ (ähnlicher Titel, nicht automatisch übernommen).`
            : 'Nicht eindeutig eine Verschwörungstheorie (Hoax, Mythos, Leugnung oder nur ein verwandtes Thema). Bitte prüfen.';
        if (await queueReview(db, known, c, en, reason)) result.reviewed.push({ title: en.title, reason });
        else giveUp(known, result, c.qid);
        continue;
      }
      const de = c.deUrl ? await fetchSummary(c.deUrl).catch(() => null) : null;
      const slug = await storeEntry(db, known, c, en, de, extra?.aliases ?? []);
      if (!slug) {
        giveUp(known, result, c.qid);
        continue;
      }
      result.imported.push({ slug, title: en.title });
    }
    result.remaining = fresh.length - picked.length;
    // A failing detail or image step never undoes or hides the imported entries.
    result.detailed = await addDetails(db).catch((err) => {
      result.detailError = String((err as Error)?.message ?? err).slice(0, 200);
      return 0;
    });
    result.detailedDe = await addGermanDetails(db).catch((err) => {
      result.detailError = String((err as Error)?.message ?? err).slice(0, 200);
      return 0;
    });
    result.images = await addCoverImages(db, imageBudgetBytes).catch((err) => {
      result.imageError = String((err as Error)?.message ?? err).slice(0, 200);
      return 0;
    });
    if (budgetLeft() > 0) result.years = await addCaseYears(db, sparql).catch(() => 0);
  } catch (err) {
    result.error = String((err as Error)?.message ?? err).slice(0, 200);
  }
  if (result.skipped) {
    await db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
      SKIPPED_KEY,
      JSON.stringify([...known.skipped]),
    );
  }
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    LAST_RESULT_KEY,
    JSON.stringify(result),
  );
  return result;
}

export async function lastImportResult(db: Db): Promise<ImportResult | null> {
  const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', LAST_RESULT_KEY);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as ImportResult;
  } catch {
    return null;
  }
}
