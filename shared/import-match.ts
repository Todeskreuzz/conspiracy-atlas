// Pure checks for the archive import: normalised titles, duplicate grouping and "is this a conspiracy theory?".
// No database and no network, so the import and the read-only duplicate report share one implementation.

const FILLER = new Set([
  'the', 'a', 'an', 'of', 'and', 'or',
  'conspiracy', 'conspiracies', 'theory', 'theories', 'claim', 'claims', 'narrative', 'narratives', 'related',
  // Function words and the words for "conspiracy theory" in German, French and Spanish, so a translated
  // title can meet the English one ("Chemtrail-Verschwörungstheorie" and "Chemtrail conspiracy theory").
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'und', 'oder', 'von', 'vom', 'zu', 'zur', 'zum', 'auf', 'fuer', 'fur', 'mit', 'im', 'am',
  'verschworung', 'verschworungstheorie', 'verschworungstheorien', 'theorie', 'theorien',
  'le', 'la', 'les', 'des', 'du', 'de', 'un', 'une', 'et', 'ou', 'sur', 'dans', 'aux', 'au', 'complot', 'complots', 'recit', 'recits', 'canular',
  'el', 'los', 'las', 'del', 'sobre', 'teoria', 'teorias', 'conspiracion', 'conspirativa', 'conspirativas', 'conspirativo',
]);

/**
 * Comparison key for titles, so "Moon landing conspiracy theories" matches the hand-written
 * "Moon Landing Conspiracy Theory" and "Chemtrail conspiracy theory" matches "Chemtrail Claims".
 * An empty key (a title made only of filler words) must not be treated as a match.
 */
export function matchKey(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bjohn f kennedy assassination\b/g, 'jfk')
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

/** Host plus article title, so a redirect and its target (and percent-encoding) compare equal. */
export function wikiUrlKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith('.wikipedia.org')) return null;
  const at = parsed.pathname.indexOf('/wiki/');
  if (at < 0) return null;
  let rest = parsed.pathname.slice(at + 6);
  try {
    rest = decodeURIComponent(rest);
  } catch {
    return null;
  }
  const title = rest.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!title || title.startsWith('special:')) return null;
  return `${parsed.hostname.toLowerCase()}/${title}`;
}

/** Wikidata QID written into source notes or into an import-review note. */
export function qidFromNote(notes: string | null | undefined): string | null {
  const m = notes?.match(/\bwikidata:(Q\d+)\b/i) ?? notes?.match(/Wikidata item (Q\d+)\b/);
  return m ? m[1] : null;
}

const THEORY_PHRASE = /conspiracy theor(?:y|ies)|verschw[oö]rungstheor\w*|th[eé]ories? du complot|teor[ií]as? de (?:la )?conspiraci[oó]n|\bblood libels?\b/i;
const AMBIGUOUS = /\b(?:hoax(?:es)?|urban legends?|myths?|denial(?:ism)?|fringe theor(?:y|ies)|pseudohistor(?:y|ical)|false flags?)\b/i;
const MENTIONED = /\b(?:mentioned|featured|discussed|cited|referenced|appearing|appears|appear|used)\b(?:\s+\w+){0,6}\s+(?:in\s+)?(?:conspiracy theor|verschw[oö]rungstheor)/i;

/** The title or the Wikipedia short description classifies the page itself as a conspiracy theory. */
export function isClearTheory(title: string, description?: string): boolean {
  if (THEORY_PHRASE.test(title) && !/\btheorists?\b/i.test(title)) return true;
  if (!description) return false;
  if (MENTIONED.test(description)) return false;
  if (/\brelated to\b/i.test(description)) {
    const head = description.split(/\brelated to\b/i)[0] ?? '';
    if (!THEORY_PHRASE.test(head)) return false;
  }
  return THEORY_PHRASE.test(description);
}

export function isAmbiguousTopic(title: string, description?: string): boolean {
  return AMBIGUOUS.test(`${title} ${description ?? ''}`);
}

/** People, lists, works and places are never cases, even when a conspiracy theory is mentioned in passing. */
export function isHardReject(title: string, description?: string): boolean {
  const trimmed = title.trim();
  if (/^(the\s+)?conspiracy theor(?:y|ies)$/i.test(trimmed)) return true;
  if (/^(list|lists|glossary|index|outline|timeline|category) of\b/i.test(trimmed)) return true;
  if (/\btheorists?\b|\(born\b|\(died\b/i.test(`${description ?? ''} ${title}`)) return true;
  if (isClearTheory(title, description)) return false;
  return /\b(feature film|documentary film|television series|tv series|studio album|video game|novel|short story|politician|singer-songwriter|\bsinger\b|\bactor\b|footballer|basketball player|terrorist attacks?|coordinated terrorist|u\.s\. state|\bcity in\b|\btown in\b|fraternal organization|secret society|businessman|entrepreneur|podcast host)\b/i.test(description ?? '');
}

export type TopicVerdict = 'clear' | 'ambiguous' | 'reject';

/** List pages: clear theories are imported, hoaxes and similar labels wait for review, the rest is dropped. */
export function topicVerdict(title: string, description?: string): TopicVerdict {
  if (isHardReject(title, description)) return 'reject';
  if (isClearTheory(title, description)) return 'clear';
  if (isAmbiguousTopic(title, description)) return 'ambiguous';
  return 'reject';
}

/** True when the page is worth considering (a theory, or an ambiguous label a reviewer should see). */
export function isTheoryPage(title: string, description: string | undefined): boolean {
  return topicVerdict(title, description) !== 'reject';
}

export function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const m = flat.match(/^.{0,400}?[.!?](?:\s|$)/);
  return (m ? m[0] : flat.slice(0, 400)).trim();
}

/** The lead sentence states that the subject is a conspiracy theory, rather than merely mentioning one. */
export function leadIsTheory(sentence: string): boolean {
  if (!sentence) return false;
  if (/\b(subject of|related to|mentioned in|inspired|led to|spawned|prompted|feature of|part of)\b/i.test(sentence)) return false;
  return /\b(is|are|was|were|ist|sind)\b[^.]{0,80}\b(conspiracy theor(?:y|ies)|verschw[oö]rungstheor\w*|th[eé]ories? du complot|teor[ií]as? de (?:la )?conspiraci[oó]n)\b/i.test(sentence);
}

export type ImportDecision = 'publish' | 'review' | 'reject';

/**
 * publish: the article is a conspiracy theory and can be added.
 * review: a hoax, a denial, a fuzzy near-duplicate, or a Wikidata hit the text does not confirm.
 * reject: a person, place, work, list, or something with no theory signal at all.
 */
export function decideImport(input: {
  title: string;
  description?: string | null;
  extract?: string | null;
  listed: 'wikidata' | 'clear' | 'ambiguous';
}): ImportDecision {
  const description = input.description ?? undefined;
  if (isHardReject(input.title, description)) return 'reject';
  // A list label such as "hoax" stays in the review queue unless the article's own description
  // classifies it as a conspiracy theory. The lead sentence alone is not enough for those.
  if (input.listed === 'ambiguous' && !isClearTheory(input.title, description)) return 'review';
  const clear = isClearTheory(input.title, description) || leadIsTheory(firstSentence(input.extract ?? ''));
  if (clear) return 'publish';
  if (isAmbiguousTopic(input.title, description) || isAmbiguousTopic(firstSentence(input.extract ?? ''), undefined)) return 'review';
  if (input.listed === 'wikidata' || input.listed === 'clear') return 'review';
  return 'reject';
}

// Shared words that do not make two theories the same ("advance knowledge" fits both Pearl Harbor and 9/11).
const GENERIC = new Set(['advance', 'knowledge', 'secret', 'world', 'government', 'people', 'american', 'america', 'united', 'national', 'global', 'modern', 'history', 'great', 'new', 'old']);

/** 0 when the keys are unrelated. 1 when they are equal. High containment of a specific shorter title is a near-duplicate. */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b || a.length < 3 || b.length < 3) return 0;
  if (a === b) return 1;
  const ta = a.split(' ').filter((w) => w.length > 2);
  const tb = b.split(' ').filter((w) => w.length > 2);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const shared: string[] = [];
  for (const t of sa) if (sb.has(t)) shared.push(t);
  if (!shared.length) return 0;
  if (!shared.some((t) => !GENERIC.has(t) && t.length >= 4)) return 0;
  const smaller = sa.size <= sb.size ? sa : sb;
  const shorterLen = [...smaller].join(' ').length;
  if (shorterLen < 8) return 0;
  const contain = shared.length / Math.min(sa.size, sb.size);
  const jaccard = shared.length / (sa.size + sb.size - shared.length);
  if (contain === 1 && (smaller.size >= 2 || shorterLen >= 12)) return Math.max(jaccard, 0.86);
  if (jaccard >= 0.6 && shared.length >= 2) return jaccard;
  return 0;
}

export const FUZZY_MIN = 0.8;

export interface LabeledKey {
  key: string;
  label: string;
}

export interface DuplicateHit {
  level: 'exact' | 'fuzzy';
  label: string;
  score: number;
}

/** Exact: same normalised title or same Wikipedia URL. Fuzzy: similar enough that a person should decide. */
export function duplicateHit(keys: string[], urls: string[], knownKeys: LabeledKey[], knownUrls: Set<string>): DuplicateHit | null {
  for (const u of urls) {
    if (u && knownUrls.has(u)) return { level: 'exact', label: u, score: 1 };
  }
  for (const k of keys) {
    if (k.length < 3) continue;
    const found = knownKeys.find((x) => x.key === k);
    if (found) return { level: 'exact', label: found.label, score: 1 };
  }
  let best: DuplicateHit | null = null;
  for (const k of keys) {
    if (k.length < 3) continue;
    for (const other of knownKeys) {
      const score = titleSimilarity(k, other.key);
      if (score >= FUZZY_MIN && (!best || score > best.score)) best = { level: 'fuzzy', label: other.label, score };
    }
  }
  return best;
}

export interface DuplicateEntry {
  id: number;
  slug: string;
  title: string;
  qid?: string | null;
  titles: string[];
  urls: string[];
}

export interface DuplicateGroup {
  kind: 'qid' | 'title' | 'url' | 'fuzzy';
  score?: number;
  items: { id: number; slug: string; title: string; detail: string }[];
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Groups cases that already share a QID, a normalised title, a Wikipedia URL, or a near-identical title. Never deletes anything. */
export function findDuplicateGroups(entries: DuplicateEntry[]): DuplicateGroup[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const groups: DuplicateGroup[] = [];
  const exactPairs = new Set<string>();

  const remember = (ids: number[]) => {
    const uniq = [...new Set(ids)].sort((a, b) => a - b);
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) exactPairs.add(pairKey(uniq[i], uniq[j]));
    return uniq;
  };

  const push = (kind: DuplicateGroup['kind'], ids: number[], detailFor: (e: DuplicateEntry) => string, score?: number) => {
    const uniq = remember(ids);
    if (uniq.length < 2) return;
    groups.push({
      kind,
      score,
      items: uniq.map((id) => {
        const e = byId.get(id)!;
        return { id, slug: e.slug, title: e.title, detail: detailFor(e) };
      }),
    });
  };

  const byQid = new Map<string, number[]>();
  for (const e of entries) {
    if (e.qid && /^Q\d+$/.test(e.qid)) {
      const list = byQid.get(e.qid) ?? [];
      list.push(e.id);
      byQid.set(e.qid, list);
    }
  }
  for (const [qid, ids] of byQid) push('qid', ids, () => qid);

  const byTitle = new Map<string, number[]>();
  for (const e of entries) {
    const keys = new Set(e.titles.map(matchKey).filter((k) => k.length >= 3));
    for (const k of keys) {
      const list = byTitle.get(k) ?? [];
      if (!list.includes(e.id)) list.push(e.id);
      byTitle.set(k, list);
    }
  }
  for (const [key, ids] of byTitle) push('title', ids, () => key);

  const byUrl = new Map<string, number[]>();
  for (const e of entries) {
    for (const url of e.urls) {
      const key = wikiUrlKey(url);
      if (!key) continue;
      const list = byUrl.get(key) ?? [];
      if (!list.includes(e.id)) list.push(e.id);
      byUrl.set(key, list);
    }
  }
  for (const [key, ids] of byUrl) push('url', ids, () => key);

  const list = [...entries];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (exactPairs.has(pairKey(a.id, b.id))) continue;
      const keysA = [...new Set(a.titles.map(matchKey).filter((k) => k.length >= 3))];
      const keysB = [...new Set(b.titles.map(matchKey).filter((k) => k.length >= 3))];
      let score = 0;
      for (const ka of keysA) for (const kb of keysB) score = Math.max(score, titleSimilarity(ka, kb));
      if (score >= FUZZY_MIN) push('fuzzy', [a.id, b.id], () => score.toFixed(2), score);
    }
  }
  return groups;
}
