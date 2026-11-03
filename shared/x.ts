// Owner-only posts for X. Text is filled from the case file. No external API.
// X counts every URL as 23 characters (t.co), whatever its real length.
import type { CategorySlug, EvidenceStatus } from './constants';
import { EVIDENCE_LABEL } from './reddit';

export const X_LIMIT = 280;
/** How many characters X charges for any link. */
export const X_URL_WEIGHT = 23;
export const X_DRAFTS_PER_DAY = 5;
export const DEFAULT_X_HANDLE = 'ConspAtlas';

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

const CATEGORY_TAG: Record<CategorySlug, string> = {
  'politics-power': 'Politics',
  'secret-organizations': 'SecretSocieties',
  'intelligence-agencies': 'Intelligence',
  'space-ufos': 'UFO',
  'science-technology': 'Science',
  history: 'History',
  'economy-finance': 'Economy',
  'media-society': 'Media',
  'internet-modern-myths': 'InternetMyths',
  'secret-operations': 'CovertOps',
};

export interface XPiece {
  /** Words only. The case link, when present, is separate so X can attach the card. */
  text: string;
  /** What to paste: words plus the case link when this post carries one. */
  composed: string;
  /** Length X will charge, with any case link counted as 23 characters. */
  length: number;
  link: string | null;
}

export type XHook = 'question' | 'gap' | 'timeline' | 'split';

export interface XDraft {
  theoryId: number;
  slug: string;
  title: string;
  imagePath: string | null;
  caseUrl: string;
  hook: XHook;
  /** Hook without the URL, so X is more likely to show it. */
  post: XPiece;
  /** Reply that carries the case link and a one-line teaser. */
  reply: XPiece;
  /** The same hook with the link in the post, so the preview card can attach. */
  withLink: XPiece;
  /** Compose box for the hook only (no url parameter). */
  intentUrl: string;
  /** Compose box for the with-link post. The url parameter is what attaches the card. */
  intentWithLinkUrl: string;
  hashtags: string[];
  evidenceStatus: EvidenceStatus;
  category: CategorySlug;
  score: number;
}

export interface XCaseInput {
  id: number;
  slug: string;
  title: string;
  imagePath?: string | null;
  summary: string;
  category: CategorySlug;
  evidenceStatus: EvidenceStatus;
  counterArgument: string | null;
  sourceTitles: string[];
  score: number;
}

export function resolveXHandle(raw: string | undefined | null): { handle: string; invalid: boolean } {
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/^@/, '') : '';
  if (!trimmed) return { handle: DEFAULT_X_HANDLE, invalid: false };
  if (HANDLE_RE.test(trimmed)) return { handle: trimmed, invalid: false };
  return { handle: DEFAULT_X_HANDLE, invalid: true };
}

/** Length X charges. A case link inside the text counts as 23, not its real length. */
export function xWeightedLength(body: string, link?: string | null): number {
  if (!link || !body.includes(link)) return body.length;
  return body.length - link.length + X_URL_WEIGHT;
}

export function xIntentUrl(text: string, link?: string | null): string {
  const params = new URLSearchParams({ text });
  if (link) params.set('url', link);
  return `https://x.com/intent/post?${params}`;
}

const HOOKS: XHook[] = ['question', 'gap', 'timeline', 'split'];

/** Rotates the hook by case id and UTC date, so the same file reads differently on another day. */
export function xHook(id: number, day: string): XHook {
  let n = Math.abs(id);
  for (let i = 0; i < day.length; i++) n += day.charCodeAt(i);
  return HOOKS[n % HOOKS.length]!;
}

function yearIn(text: string): string | null {
  const match = text.match(/\b(?:1[0-9]{3}|20[0-9]{2})\b/);
  return match ? match[0] : null;
}

function piece(text: string, link: string | null): XPiece {
  const composed = link ? (text ? `${text} ${link}` : link) : text;
  const length = link ? text.length + (text ? 1 : 0) + X_URL_WEIGHT : text.length;
  return { text, composed, length, link };
}

function clipWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, Math.max(1, max - 1));
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function hashtags(category: CategorySlug): string[] {
  return ['#ConspiracyAtlas', `#${CATEGORY_TAG[category]}`];
}

function fit(build: (claim: string) => string, claim: string, link: string): string {
  const full = build(claim);
  if (xWeightedLength(`${full} ${link}`, link) <= X_LIMIT) return full;
  const words = claim.split(/\s+/).filter(Boolean);
  for (let n = words.length - 1; n >= 1; n--) {
    const shorter = build(`${words.slice(0, n).join(' ')}…`);
    if (xWeightedLength(`${shorter} ${link}`, link) <= X_LIMIT) return shorter;
  }
  const tiny = build('…');
  return xWeightedLength(`${tiny} ${link}`, link) <= X_LIMIT ? tiny : clipWords(tiny, X_LIMIT - X_URL_WEIGHT - 1);
}

const CTA = 'Full case file, sources & counter-arguments →';

function hookBody(kind: XHook, title: string, claim: string, label: string, year: string | null, daily: boolean): string {
  const head = daily ? 'Case of the Day — ' : '';
  if (kind === 'question') return `${head}${title}: what does the file actually record?\nClaim: ${claim}\nEvidence: ${label}`;
  if (kind === 'gap') return `${head}What the short version leaves out.\nClaim on file: ${claim}\nEvidence: ${label}`;
  if (kind === 'timeline') {
    return year
      ? `${head}${year}, as the file records it.\nClaim: ${claim}\nEvidence: ${label}`
      : `${head}Only part of the file's timeline fits here.\nClaim: ${claim}\nEvidence: ${label}`;
  }
  return `${head}Claim: ${claim}\nEvidence label: ${label}. The file does not treat those as the same thing.`;
}

function finish(body: string, tags: string): string {
  return `${body}\n${CTA}\n${tags}`;
}

/** Hook, reply, and with-link post. The link counts as 23 characters. Nothing is invented. */
export function buildXDraft(input: XCaseInput, opts: { origin: string; day: string; daily?: boolean }): XDraft {
  const link = `${opts.origin.replace(/\/$/, '')}/theory/${encodeURIComponent(input.slug)}`;
  const tags = hashtags(input.category);
  const tagLine = tags.join(' ');
  const label = EVIDENCE_LABEL[input.evidenceStatus];
  const title = clipWords(input.title.replace(/\s+/g, ' ').trim() || 'Untitled case', 80);
  const claim = input.summary.replace(/\s+/g, ' ').trim() || '…';
  const year = yearIn(`${input.title} ${input.summary}`);
  const kind = xHook(input.id, opts.day);
  const build = (c: string) => finish(hookBody(kind, title, c, label, year, !!opts.daily), tagLine);
  let text = fit(build, claim, link);
  if (text.length > X_LIMIT || xWeightedLength(`${text} ${link}`, link) > X_LIMIT) {
    text = fit((c) => finish(hookBody(kind, clipWords(title, 40), c, label, year, !!opts.daily), tagLine), claim, link);
  }
  while ((text.length > X_LIMIT || xWeightedLength(`${text} ${link}`, link) > X_LIMIT) && text.length > 40) {
    text = clipWords(text, text.length - 12);
  }
  const post = piece(text, null);
  const withLink = piece(text, link);
  const teaser = clipWords(claim, 140);
  let replyText = `${teaser}\n${CTA}`;
  while (xWeightedLength(`${replyText} ${link}`, link) > X_LIMIT && replyText.length > CTA.length + 2) {
    replyText = `${clipWords(teaser, Math.max(12, replyText.indexOf('\n') - 8))}\n${CTA}`;
    if (replyText.length < 40) break;
  }
  if (xWeightedLength(`${replyText} ${link}`, link) > X_LIMIT) replyText = CTA;
  const reply = piece(replyText, link);
  return {
    theoryId: input.id,
    slug: input.slug,
    title: input.title,
    imagePath: input.imagePath ?? null,
    caseUrl: link,
    hook: kind,
    post,
    reply,
    withLink,
    intentUrl: xIntentUrl(post.text),
    intentWithLinkUrl: xIntentUrl(withLink.text, link),
    hashtags: tags,
    evidenceStatus: input.evidenceStatus,
    category: input.category,
    score: input.score,
  };
}
