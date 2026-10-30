// Automatic archive import from Wikidata + Wikipedia (free public APIs, no key, no Cloudflare resource).
//
// Every run takes a small batch of Wikidata items that are a "conspiracy theory" (Q17379835, incl. subclasses)
// and have an English Wikipedia article, skips everything already in the archive and stores the rest
// as neutral entries: the Wikipedia lead text (CC BY-SA 4.0, attributed) plus the article as the source.
// Nothing is invented: no claims, ratings or connections are derived from the text.
import type { Db } from './db';
import { slugify } from '../shared/validation';
import type { CategorySlug } from '../shared/constants';
import type { RichNode } from '../shared/richtext';

export const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const EN_WIKI = 'https://en.wikipedia.org/wiki/';
const DE_WIKI = 'https://de.wikipedia.org/wiki/';
const USER_AGENT = 'ConspiracyAtlasImporter/1.0 (https://conspiracy-atlas.pages.dev; archive import)';

/** Items per run: 1 SPARQL request + max. 2 summaries per item stays far below the 50 subrequests of Workers Free. */
export const IMPORT_BATCH = 12;
/** Minimum time between two runs, whoever triggers them. */
export const IMPORT_INTERVAL_MIN = 20;

export const LAST_RUN_KEY = 'import.last_run';
export const LAST_RESULT_KEY = 'import.last_result';
/** Wikidata items that have no usable article (disambiguation, deleted, too short); never retried. */
export const SKIPPED_KEY = 'import.skipped';

export const IMPORT_QUERY = `SELECT ?item ?en ?de WHERE {
  ?item wdt:P31/wdt:P279* wd:Q17379835 .
  ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?de schema:about ?item ; schema:isPartOf <https://de.wikipedia.org/> . }
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

export async function fetchCandidates(): Promise<Candidate[]> {
  return parseCandidates(await getJson(`${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(IMPORT_QUERY)}`));
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

export async function runImport(db: Db, batch = IMPORT_BATCH): Promise<ImportResult> {
  const result: ImportResult = { ranAt: new Date().toISOString(), imported: [], skipped: 0, remaining: 0, error: null };
  const known = await knownEntries(db);
  try {
    const candidates = await fetchCandidates();
    const fresh = candidates.filter(
      (c) => !known.skipped.has(c.qid) && !known.urls.has(decodeURIComponent(c.enUrl).replace(/_/g, ' ').toLowerCase()) && !known.titles.has(matchKey(articleTitle(c.enUrl))),
    );
    let used = 0;
    for (const c of fresh) {
      if (used >= batch) break;
      used++;
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
    result.remaining = Math.max(0, fresh.length - used);
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
