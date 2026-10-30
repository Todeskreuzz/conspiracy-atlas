// Automatic archive import from Wikidata + Wikipedia (free public APIs, no key, no Cloudflare resource).
//
// Every run takes a small batch of Wikidata items that are a "conspiracy theory" (Q159535, or one of its subclasses up to two levels deep)
// and have an English Wikipedia article, plus the theory articles linked from Wikipedia's "List of conspiracy theories", skips everything already in the archive and stores the rest
// as neutral entries: the Wikipedia lead text (CC BY-SA 4.0, attributed) plus the article as the source.
// Nothing is invented: no claims, ratings or connections are derived from the text.
import type { Db } from './db';
import { slugify } from '../shared/validation';
import type { CategorySlug } from '../shared/constants';
import type { RichNode } from '../shared/richtext';
import { IMAGE_LIMITS, sniffImageMime } from '../shared/images';
import { randomToken, toHex } from './crypto';

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const EN_WIKI = 'https://en.wikipedia.org/wiki/';
const DE_WIKI = 'https://de.wikipedia.org/wiki/';
const USER_AGENT = 'ConspiracyAtlasImporter/1.0 (https://conspiracy-atlas.pages.dev; archive import)';

/** Items per run: 1 SPARQL request + max. 2 summaries per item stays far below the 50 subrequests of Workers Free. */
export const IMPORT_BATCH = 10;
/** Minimum time between two runs, whoever triggers them. */
export const IMPORT_INTERVAL_MIN = 20;

export const LAST_RUN_KEY = 'import.last_run';
export const LAST_RESULT_KEY = 'import.last_result';
/** Wikidata items that have no usable article (disambiguation, deleted, too short); never retried. */
export const SKIPPED_KEY = 'import.skipped';
/** Imported theories whose article has no freely licensed lead image; never retried. */
export const NO_IMAGE_KEY = 'import.no_image';
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
}`;

/** German articles are looked up only for the items of the current batch, which keeps both queries fast. */
export const germanQuery = (qids: string[]) => `SELECT ?item ?de WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  ?de schema:about ?item ; schema:isPartOf <https://de.wikipedia.org/> .
}`;

/** Replaceable in tests. */
export const importFetch: { impl: typeof fetch } = { impl: (...args) => fetch(...args) };

export interface Candidate {
  qid: string;
  enUrl: string;
  deUrl: string | null;
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
const FILLER = new Set(['the', 'a', 'conspiracy', 'conspiracies', 'theory', 'theories', 'claim', 'claims', 'narrative', 'narratives', 'related']);

/**
 * Comparison key for titles, so "Moon landing conspiracy theories" (Wikipedia) matches the hand-written
 * "Moon Landing Conspiracy Theory" and "Chemtrail conspiracy theory" matches "Chemtrail Claims".
 */
export function matchKey(title: string): string {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bjohn f kennedy assassination\b/g, 'jfk')
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

export function parseCandidates(data: unknown): Candidate[] {
  const rows = (data as { results?: { bindings?: Record<string, { value?: string }>[] } })?.results?.bindings ?? [];
  const byQid = new Map<string, Candidate>();
  for (const r of rows) {
    const qid = r.item?.value?.split('/').pop() ?? '';
    const enUrl = r.en?.value ?? '';
    if (!/^Q\d+$/.test(qid) || !enUrl.startsWith(EN_WIKI)) continue;
    const deUrl = r.de?.value?.startsWith(DE_WIKI) ? r.de.value : null;
    if (!byQid.has(qid)) byQid.set(qid, { qid, enUrl, deUrl });
  }
  // Oldest Wikidata items first: they are usually the best-known theories.
  return [...byQid.values()].sort((a, b) => qNumber(a.qid) - qNumber(b.qid));
}

async function getJson(url: string): Promise<unknown> {
  const res = await importFetch.impl(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

const sparql = async (query: string) => getJson(`${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`);

export const LIST_PAGE = 'List_of_conspiracy_theories';
const LIST_API = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&generator=links&titles=${LIST_PAGE}&gplnamespace=0&gpllimit=max&prop=description%7Cpageprops&ppprop=wikibase_item%7Cdisambiguation`;
/** The list has about 1,500 links (4 API pages); the cap only guards against a runaway continuation. */
const LIST_MAX_REQUESTS = 6;

// The list also links people, places, media and concepts. Only articles whose Wikipedia short description
// (or, without one, whose title) names a conspiracy theory, hoax, denial or similar narrative are taken.
const THEORY_DESCRIPTION = /conspiracy theor(y|ies)|\bhoax(es)?\b|urban legend|\bmyths?\b|blood libel|\bdenial\b/i;
const THEORY_TITLE = /conspirac(y|ies)(?! theorist)|\bhoax\b/i;

export function isTheoryPage(title: string, description: string | undefined): boolean {
  if (/theorists?\b|\(born\b/i.test(description ?? '')) return false;
  return description ? THEORY_DESCRIPTION.test(description) : THEORY_TITLE.test(title);
}

export function parseListPages(data: unknown): Candidate[] {
  const pages = (data as { query?: { pages?: Record<string, unknown>[] } })?.query?.pages ?? [];
  const out: Candidate[] = [];
  for (const p of pages) {
    const title = typeof p.title === 'string' ? p.title : '';
    const props = (p.pageprops ?? {}) as { wikibase_item?: string; disambiguation?: string };
    const description = typeof p.description === 'string' ? p.description : undefined;
    if (!title || p.missing || props.disambiguation !== undefined || !/^Q\d+$/.test(props.wikibase_item ?? '')) continue;
    if (!isTheoryPage(title, description)) continue;
    out.push({ qid: props.wikibase_item!, enUrl: EN_WIKI + encodeURIComponent(title.replace(/ /g, '_')), deUrl: null });
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

/** Fills in the German article of each candidate (if one exists). A failure only means no translation. */
async function addGermanLinks(batch: Candidate[]): Promise<void> {
  if (!batch.length) return;
  try {
    const rows = (await sparql(germanQuery(batch.map((c) => c.qid)))) as { results?: { bindings?: Record<string, { value?: string }>[] } };
    const byQid = new Map<string, string>();
    for (const r of rows?.results?.bindings ?? []) {
      const qid = r.item?.value?.split('/').pop() ?? '';
      if (r.de?.value?.startsWith(DE_WIKI)) byQid.set(qid, r.de.value);
    }
    for (const c of batch) c.deUrl ??= byQid.get(c.qid) ?? null;
  } catch {
    // keep English only
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

async function uniqueSlug(db: Db, base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    if (!(await db.first('SELECT 1 AS x FROM theories WHERE slug = ?', slug))) return slug;
  }
  return `${root}-${Date.now()}`;
}

/** Wikipedia URLs and titles that are already in the archive (hand-written cases included). */
async function knownEntries(db: Db) {
  const skippedRow = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', SKIPPED_KEY);
  let skipped: string[] = [];
  try {
    skipped = skippedRow ? (JSON.parse(skippedRow.value) as string[]) : [];
  } catch {
    skipped = [];
  }
  const urls = new Set(
    (await db.all<{ url: string }>("SELECT url FROM sources WHERE url LIKE 'https://en.wikipedia.org/wiki/%'")).map((r) =>
      decodeURIComponent(r.url).replace(/_/g, ' ').toLowerCase(),
    ),
  );
  const titles = new Set((await db.all<{ title: string }>('SELECT title FROM theories')).map((r) => matchKey(r.title)));
  return { urls, titles, skipped: new Set(skipped) };
}

async function storeEntry(db: Db, c: Candidate, en: WikiSummary, de: WikiSummary | null): Promise<string> {
  const slug = await uniqueSlug(db, en.title);
  const category = guessCategory(`${en.title} ${en.description ?? ''} ${en.extract.slice(0, 400)}`);
  const theory = await db.first<{ id: number }>(
    `INSERT INTO theories (slug, title, subtitle, summary, body_json, category_id, evidence_status, origin, content_language, is_published)
     SELECT ?, ?, ?, ?, ?, id, 'unverified', 'editorial', 'en', 1 FROM categories WHERE slug = ? RETURNING id`,
    slug,
    en.title,
    en.description,
    firstSentences(en.extract),
    JSON.stringify(attributionDoc(en, 'en')),
    category,
  );
  if (!theory) throw new Error(`category ${category} missing`);
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
  await db.batch(stmts);
  return slug;
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

const wikiApi = (params: string) => `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&${params}`;
// Commons serves thumbnails from either host.
const isCommonsThumb = (url: string) => url.startsWith('https://thumb.wikimedia.org/') || url.startsWith('https://upload.wikimedia.org/');
const titlesParam = (titles: string[]) => titles.map((t) => encodeURIComponent(t)).join('%7C');

interface ApiPage {
  title?: string;
  pageimage?: string;
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

async function addCoverImages(db: Db, imageBudgetBytes: number): Promise<number> {
  const noImageRow = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', NO_IMAGE_KEY);
  let noImage: number[] = [];
  try {
    noImage = noImageRow ? (JSON.parse(noImageRow.value) as number[]) : [];
  } catch {
    noImage = [];
  }
  const skip = new Set(noImage);
  const rows = await db.all<{ id: number; url: string }>(
    `SELECT t.id, s.url FROM theories t
     JOIN evidence e ON e.theory_id = t.id JOIN sources s ON s.id = e.source_id
     WHERE t.image_path IS NULL AND s.publisher = 'Wikipedia (English)' AND s.notes LIKE 'Imported automatically%'
     ORDER BY t.id LIMIT 200`,
  );
  const todo = rows.filter((r) => !skip.has(r.id)).slice(0, IMAGE_BATCH);
  if (!todo.length) return 0;

  const titleOf = (url: string) => articleTitle(url);
  const titles = todo.map((r) => titleOf(r.url));
  const pi = pagesByRequestedTitle((await getJson(wikiApi(`prop=pageimages&piprop=name&pilicense=free&titles=${titlesParam(titles)}`))) as ApiQuery, titles);
  const fileOf = new Map<number, string>();
  for (const r of todo) {
    const name = pi.get(titleOf(r.url))?.pageimage;
    if (name) fileOf.set(r.id, `File:${name.replace(/_/g, ' ')}`);
  }
  const files = [...new Set(fileOf.values())];
  const info = files.length
    ? pagesByRequestedTitle(
        (await getJson(
          wikiApi(`prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=${IMAGE_WIDTH}&iiextmetadatafilter=LicenseShortName%7CArtist%7CNonFree&titles=${titlesParam(files)}`),
        )) as ApiQuery,
        files,
      )
    : new Map<string, ApiPage>();

  let used = Number((await db.first<{ n: number }>('SELECT COALESCE(SUM(size), 0) AS n FROM images'))?.n ?? 0);
  let added = 0;
  for (const r of todo) {
    const file = fileOf.get(r.id);
    const ii = file ? info.get(file)?.imageinfo?.[0] : undefined;
    const meta = ii?.extmetadata ?? {};
    const license = meta.LicenseShortName?.value;
    const thumb = ii?.thumburl;
    if (!file || !ii || !thumb || !isCommonsThumb(thumb) || !isFreeLicense(license, meta.NonFree?.value)) {
      skip.add(r.id);
      continue;
    }
    const res = await importFetch.impl(thumb, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from Wikimedia Commons`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = sniffImageMime(bytes);
    const width = Number(ii.thumbwidth) || 0;
    const height = Number(ii.thumbheight) || 0;
    if (!mime || bytes.length === 0 || bytes.length > IMAGE_LIMITS.maxBytes || width < 1 || height < 1 || width > 4096 || height > 4096) {
      skip.add(r.id);
      continue;
    }
    if (used + bytes.length > imageBudgetBytes) break; // free storage budget reached: keep the placeholder
    const artist = stripHtml(meta.Artist?.value ?? '').slice(0, 150) || 'Unknown author';
    const credit = `${artist} · ${stripHtml(license!)} · Wikimedia Commons`.slice(0, 300);
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
        `${file} – Wikimedia Commons`, descUrl, `Cover image imported automatically. Licence: ${stripHtml(license!)}.`,
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
  return added;
}

export async function runImport(db: Db, batch = IMPORT_BATCH, imageBudgetBytes = IMAGE_LIMITS.defaultStorageMb * 1024 * 1024): Promise<ImportResult> {
  const result: ImportResult = { ranAt: new Date().toISOString(), imported: [], skipped: 0, remaining: 0, images: 0, error: null };
  const known = await knownEntries(db);
  try {
    const candidates = await fetchCandidates();
    const fresh = candidates.filter(
      (c) => !known.skipped.has(c.qid) && !known.urls.has(decodeURIComponent(c.enUrl).replace(/_/g, ' ').toLowerCase()) && !known.titles.has(matchKey(articleTitle(c.enUrl))),
    );
    const picked = fresh.slice(0, batch);
    await addGermanLinks(picked);
    for (const c of picked) {
      const en = await fetchSummary(c.enUrl);
      if (!en || known.titles.has(matchKey(en.title))) {
        result.skipped++;
        known.skipped.add(c.qid);
        continue;
      }
      const de = c.deUrl ? await fetchSummary(c.deUrl).catch(() => null) : null;
      const slug = await storeEntry(db, c, en, de);
      known.titles.add(matchKey(en.title));
      result.imported.push({ slug, title: en.title });
    }
    result.remaining = fresh.length - picked.length;
    // A failing image download never undoes or hides the imported entries.
    result.images = await addCoverImages(db, imageBudgetBytes).catch((err) => {
      result.imageError = String((err as Error)?.message ?? err).slice(0, 200);
      return 0;
    });
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
