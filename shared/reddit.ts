// Owner-only Reddit drafts. Text is filled from the case file with fixed templates (no external API).
// Ranking is deliberate and explainable:
//   recency     — how recently the file was updated (half-life 45 days, max 50)
//   status      — open or disputed labels rank above settled ones (max 20)
//   discussion  — claims, counter-arguments and connections, capped at 20
//   interest    — visible comments and votes, capped at 20
// The server scores the 300 most recently updated published cases plus the 80 most
// commented, then offers the top few that have not been marked as posted.
import type { CategorySlug, EvidenceStatus } from './constants';

export const REDDIT_DRAFTS_PER_DAY = 5;
/** Newest published cases considered, before the score is applied. */
export const REDDIT_RECENT_POOL = 300;
/** Most-commented published cases added to that pool, so an older discussion is not ignored. */
export const REDDIT_ENGAGED_POOL = 80;
export const REDDIT_TITLE_MAX = 300;
/** Exact flair on r/ConspiracyAtlas. Mods apply it by hand. */
export const CASE_OF_THE_DAY_FLAIR = 'Atlas Case of the Day';
const CASE_OF_THE_DAY_PREFIX = 'Atlas Case of the Day: ';
/** r/ConspiracyAtlas — still overridable with the REDDIT_SUBREDDIT variable. */
export const DEFAULT_REDDIT_SUBREDDIT = 'ConspiracyAtlas';
/** Submit links longer than this drop the body; the owner pastes it instead. */
export const REDDIT_SUBMIT_URL_BUDGET = 8000;

const SUBREDDIT_RE = /^[A-Za-z0-9_]{3,21}$/;

/** English labels, matching src/i18n/locales/en.json. Posts are always English. */
export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  historically_documented: 'Historically documented',
  supported_by_evidence: 'Supported by evidence',
  partially_supported: 'Partially supported',
  disputed: 'Disputed',
  unverified: 'Unverified',
  debunked: 'Debunked',
  under_investigation: 'Under investigation',
};

export const EVIDENCE_HELP: Record<EvidenceStatus, string> = {
  historically_documented: 'Established by primary records such as official documents, court records or contemporaneous evidence.',
  supported_by_evidence: 'Backed by credible evidence, but not fully established.',
  partially_supported: 'Some elements are supported, others are not.',
  disputed: 'Credible sources disagree; the evidence is contested.',
  unverified: 'Claimed, but not supported by verifiable evidence.',
  debunked: 'Contradicted by strong, independent evidence.',
  under_investigation: 'Currently being reviewed by the editors.',
};

export const CATEGORY_LABEL: Record<CategorySlug, string> = {
  'politics-power': 'Politics & Power',
  'secret-organizations': 'Secret Organizations',
  'intelligence-agencies': 'Intelligence Agencies',
  'space-ufos': 'Space & UFOs',
  'science-technology': 'Science & Technology',
  history: 'History',
  'economy-finance': 'Economy & Finance',
  'media-society': 'Media & Society',
  'internet-modern-myths': 'Internet & Modern Myths',
  'secret-operations': 'Secret Operations',
};

/** Suggested Reddit flair. The owner applies it by hand; Reddit is not called. */
export const CATEGORY_FLAIR: Record<CategorySlug, string> = {
  'politics-power': 'Politics',
  'secret-organizations': 'Secret societies',
  'intelligence-agencies': 'Intelligence',
  'space-ufos': 'UFOs & space',
  'science-technology': 'Science',
  history: 'History',
  'economy-finance': 'Economy',
  'media-society': 'Media',
  'internet-modern-myths': 'Internet myths',
  'secret-operations': 'Covert operations',
};

const STATUS_WEIGHT: Record<EvidenceStatus, number> = {
  under_investigation: 20,
  disputed: 18,
  unverified: 14,
  partially_supported: 10,
  debunked: 8,
  supported_by_evidence: 6,
  historically_documented: 4,
};

export interface RedditScoreInput {
  updatedAt: string;
  evidenceStatus: EvidenceStatus;
  claimCount: number;
  counterCount: number;
  connectionCount: number;
  commentCount: number;
  voteCount: number;
}

export interface RedditScore {
  total: number;
  recency: number;
  status: number;
  discussion: number;
  interest: number;
  ageDays: number;
}

export interface RedditClaim {
  id: number;
  text: string;
  evidenceStatus: EvidenceStatus;
}

export interface RedditCase {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  category: CategorySlug;
  evidenceStatus: EvidenceStatus;
  updatedAt: string;
  claims: RedditClaim[];
  counterArguments: string[];
  sourceTitles: string[];
  claimCount: number;
  counterCount: number;
  connectionCount: number;
  commentCount: number;
  voteCount: number;
  sourceCount: number;
}

export interface RedditDraft {
  theoryId: number;
  slug: string;
  title: string;
  body: string;
  flair: string;
  caseUrl: string;
  submitUrl: string;
  /** `full` prefills title and text. `title-only` when the text does not fit in the address. */
  submitMode: 'full' | 'title-only';
  score: number;
  breakdown: { recency: number; status: number; discussion: number; interest: number };
  evidenceStatus: EvidenceStatus;
  category: CategorySlug;
  updatedAt: string;
  ageDays: number;
  claimCount: number;
  commentCount: number;
}

export interface RedditPosted {
  theoryId: number;
  slug: string;
  title: string;
  postedAt: string;
  actor: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const nonNeg = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** Age in days of a SQLite UTC timestamp (`YYYY-MM-DD HH:MM:SS`). Unknown values sort as very old. */
export function redditAgeDays(sqlTime: string, now: Date): number {
  const d = new Date(`${sqlTime.replace(' ', 'T').slice(0, 19)}Z`);
  if (Number.isNaN(d.getTime())) return 3650;
  return Math.max(0, (now.getTime() - d.getTime()) / 86_400_000);
}

export function scoreRedditCase(input: RedditScoreInput, now: Date): RedditScore {
  const ageDays = redditAgeDays(input.updatedAt, now);
  const recency = r1(50 * Math.exp(-ageDays / 45));
  const status = STATUS_WEIGHT[input.evidenceStatus] ?? 0;
  const discussion = Math.min(
    20,
    Math.min(nonNeg(input.claimCount), 4) * 3 + Math.min(nonNeg(input.counterCount), 3) * 3 + Math.min(nonNeg(input.connectionCount), 5),
  );
  const interest = r1(Math.min(20, Math.min(nonNeg(input.commentCount), 10) * 1.5 + Math.min(nonNeg(input.voteCount), 10) * 0.5));
  return { total: r1(recency + status + discussion + interest), recency, status, discussion, interest, ageDays: Math.round(ageDays) };
}

export function rankRedditCases<T extends RedditScoreInput & { id: number }>(cases: T[], now: Date): Array<T & { score: RedditScore }> {
  return cases
    .map((c) => ({ ...c, score: scoreRedditCase(c, now) }))
    .sort((a, b) => b.score.total - a.score.total || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

/** Empty or valid name. Anything else is rejected and the default subreddit is used. */
export function resolveSubreddit(raw: string | undefined | null): { name: string; invalid: boolean } {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { name: DEFAULT_REDDIT_SUBREDDIT, invalid: false };
  if (SUBREDDIT_RE.test(trimmed)) return { name: trimmed, invalid: false };
  return { name: DEFAULT_REDDIT_SUBREDDIT, invalid: true };
}

export function redditSubmitUrl(subreddit: string, title: string, body: string): { url: string; mode: 'full' | 'title-only' } {
  const base = `https://www.reddit.com/r/${subreddit}/submit`;
  const full = `${base}?${new URLSearchParams({ title, text: body })}`;
  if (full.length <= REDDIT_SUBMIT_URL_BUDGET) return { url: full, mode: 'full' };
  return { url: `${base}?${new URLSearchParams({ title })}`, mode: 'title-only' };
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Keeps case text from breaking the surrounding markdown. */
function mdInline(text: string): string {
  return text.replace(/[*_`[\]]/g, (c) => `\\${c}`);
}

const TITLE_FRAMES: Record<EvidenceStatus, Array<(title: string) => string>> = {
  disputed: [
    (t) => `What does the record actually say about ${t}?`,
    (t) => `${t}: the claim, the sources, and what is still disputed`,
    (t) => `${t} — where the cited sources disagree`,
  ],
  unverified: [
    (t) => `${t}: what is claimed, and what is still unverified`,
    (t) => `What would it take to verify the claims around ${t}?`,
    (t) => `${t} is widely repeated. What does the sourced record show?`,
  ],
  under_investigation: [
    (t) => `${t} is still being checked. What should the record include?`,
    (t) => `Open file: ${t} — what is known, and what is not`,
  ],
  partially_supported: [
    (t) => `${t}: which parts hold up, and which parts do not?`,
    (t) => `Part of ${t} is supported. Where does the claim go further?`,
  ],
  debunked: [
    (t) => `${t}: what the evidence contradicts`,
    (t) => `Why the central claim around ${t} does not hold up`,
  ],
  historically_documented: [
    (t) => `${t}: what is documented, and what is still only claimed`,
    (t) => `The documented record on ${t}, and the claims built around it`,
  ],
  supported_by_evidence: [
    (t) => `${t}: what the evidence supports, and what it does not`,
    (t) => `What is actually supported in the file on ${t}?`,
  ],
};

const HOOK: Record<EvidenceStatus, (title: string) => string> = {
  disputed: (title) =>
    `The file on ${title} is still argued over, and the sources do not all say the same thing. Here is the short version from the archive, with the claim kept separate from what the evidence label actually says.`,
  unverified: (title) =>
    `The story of ${title} gets repeated often. Repetition is not evidence. Here is what the case file records, and the label the archive puts on that evidence.`,
  under_investigation: (title) =>
    `The file on ${title} is still open. This is the current summary, not a conclusion, and the evidence label may change when better sources turn up.`,
  partially_supported: (title) =>
    `Some of what circulates about ${title} lines up with the record, and some of it goes further than the sources. Here is where the case file draws that line.`,
  debunked: (title) =>
    `${title} is still told as if it were an open mystery. The archive's evidence label says the central claim has been contradicted. Here is the claim, and what the file says the record shows.`,
  historically_documented: (title) =>
    `${title} has a documented record. Wider stories are often built on top of that record. Here is what the case file treats as documented, and what it does not.`,
  supported_by_evidence: (title) =>
    `There is real evidence in the file on ${title}, and there are still claims that outrun it. Here is the summary, with the evidence label kept in view.`,
};

const QUESTIONS: Record<EvidenceStatus, [string, string]> = {
  disputed: [
    'Which cited source do you find strongest, and which one do you trust least?',
    'Is the dispute about what happened, or about what those facts are supposed to mean?',
  ],
  unverified: [
    'What primary record (a document, dataset or official file) would move this out of "unverified"?',
    'Which part of the popular version is not actually in the case file?',
  ],
  under_investigation: [
    'What should the editors still be looking for before this label changes?',
    'Which claim in the file is the most checkable right now?',
  ],
  partially_supported: [
    'Which piece is supported, and which piece is still only a claim?',
    'Where do retellings add something the sources do not say?',
  ],
  debunked: [
    'Which part of the popular version, if any, survives contact with the cited sources?',
    'What keeps the story in circulation when the central claim is contradicted?',
  ],
  historically_documented: [
    'Where does the documented record end, and where does the wider theory begin?',
    'Which later claim borrows the credibility of the documented part?',
  ],
  supported_by_evidence: [
    'What would a fair counter-argument still need to address?',
    'What does the evidence support directly, and what is only inferred from it?',
  ],
};

/** Title for the daily card. The prefix stays intact; the case title is shortened if needed. */
export function caseOfTheDayTitle(caseTitle: string, status: EvidenceStatus): string {
  const clean = caseTitle.replace(/\s+/g, ' ').trim() || 'Untitled case';
  const suffix = ` — ${EVIDENCE_LABEL[status]}`;
  const full = `${CASE_OF_THE_DAY_PREFIX}${clean}${suffix}`;
  if (full.length <= REDDIT_TITLE_MAX) return full;
  const room = REDDIT_TITLE_MAX - CASE_OF_THE_DAY_PREFIX.length - suffix.length;
  if (room >= 8) return `${CASE_OF_THE_DAY_PREFIX}${clip(clean, room)}${suffix}`;
  return clip(`${CASE_OF_THE_DAY_PREFIX}${clean}`, REDDIT_TITLE_MAX);
}

function redditTitle(id: number, title: string, status: EvidenceStatus): string {
  const clean = title.replace(/\s+/g, ' ').trim() || 'Untitled case';
  const frames = TITLE_FRAMES[status];
  let out = frames[Math.abs(id) % frames.length]!(clean);
  if (out.length <= REDDIT_TITLE_MAX) return out;
  out = `${clip(clean, 240)} — ${EVIDENCE_LABEL[status]}`;
  return out.length <= REDDIT_TITLE_MAX ? out : clip(clean, REDDIT_TITLE_MAX);
}

function caseUrl(origin: string, slug: string): string {
  const root = origin.replace(/\/$/, '');
  return `${root}/theory/${encodeURIComponent(slug)}`;
}

/** One ready-to-post draft. Deterministic for the same case and clock. */
export function buildRedditDraft(theory: RedditCase, opts: { origin: string; subreddit: string; now?: Date; daily?: boolean }): RedditDraft {
  const now = opts.now ?? new Date();
  const score = scoreRedditCase(theory, now);
  const status = theory.evidenceStatus;
  const plainTitle = theory.title.replace(/\s+/g, ' ').trim() || 'Untitled case';
  const title = opts.daily ? caseOfTheDayTitle(plainTitle, status) : redditTitle(theory.id, plainTitle, status);
  const link = caseUrl(opts.origin, theory.slug);
  const home = `${opts.origin.replace(/\/$/, '')}/`;
  const claims = theory.claims.filter((c) => c.text.trim()).slice(0, 3);
  const counters = theory.counterArguments.map((t) => t.trim()).filter(Boolean).slice(0, 2);
  const sources = theory.sourceTitles.map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const [q1, q2] = QUESTIONS[status];
  const q3 = counters.length
    ? 'Do the counter-arguments on file answer the claim itself, or only a simplified version of it?'
    : 'What is the strongest counter-argument that is missing from this file?';

  const lines = [
    ...(opts.daily ? ["Today's Case of the Day on The Conspiracy Atlas.", ''] : []),
    HOOK[status](plainTitle),
    '',
    `**Case:** ${mdInline(plainTitle)}${theory.subtitle ? ` — ${mdInline(clip(theory.subtitle, 180))}` : ''}`,
    `**Archive section:** ${CATEGORY_LABEL[theory.category]}`,
    `**Evidence label on the file:** ${EVIDENCE_LABEL[status]}`,
    '',
    '### The claim, as the file summarises it',
    '',
    'This is the archive summary, not a finding:',
    '',
    mdInline(clip(theory.summary, 700)),
  ];

  if (claims.length) {
    lines.push(
      '',
      '### Claims recorded in the file',
      '',
      'Each line is a claim. The label after it is the archive\'s evidence label for that claim, not part of the claim.',
      '',
    );
    for (const c of claims) lines.push(`- ${mdInline(clip(c.text, 320))} *(${EVIDENCE_LABEL[c.evidenceStatus]})*`);
    if (theory.claimCount > claims.length) lines.push('', `The file has ${theory.claimCount} claims. The rest are on the case page.`);
  }

  lines.push(
    '',
    '### What the evidence label actually says',
    '',
    `The label for the file as a whole is **${EVIDENCE_LABEL[status]}**. ${EVIDENCE_HELP[status]} That label is an editorial reading of the sources. It is not a source, and it does not turn the summary into a fact.`,
  );

  if (counters.length) {
    lines.push('', 'Counter-arguments already on file:', '');
    for (const text of counters) lines.push(`- ${mdInline(clip(text, 320))}`);
  }

  if (sources.length) {
    const extra = theory.sourceCount > sources.length ? ` (${theory.sourceCount} sources are linked on the case page)` : '';
    lines.push('', `Sources linked from this file include ${sources.map((s) => mdInline(clip(s, 140))).join('; ')}.${extra}`);
  } else {
    lines.push('', 'The citations for this file live on the case page rather than in this short post.');
  }

  lines.push(
    '',
    '### Open questions',
    '',
    `1. ${q1}`,
    `2. ${q2}`,
    `3. ${q3}`,
    '',
    '### Read the case file',
    '',
    `Claims, sources and evidence labels: ${link}`,
    '',
    '---',
    '',
    `*Disclosure: I run [The Conspiracy Atlas](${home}), a source-linked archive of claims, sources and evidence labels. I am posting this for discussion, not to present an unproven claim as fact. If a source is missing or a label looks wrong, say so and point to the record.*`,
  );

  const body = lines.join('\n');
  const submit = redditSubmitUrl(opts.subreddit, title, body);
  return {
    theoryId: theory.id,
    slug: theory.slug,
    title,
    body,
    flair: opts.daily ? CASE_OF_THE_DAY_FLAIR : CATEGORY_FLAIR[theory.category],
    caseUrl: link,
    submitUrl: submit.url,
    submitMode: submit.mode,
    score: score.total,
    breakdown: { recency: score.recency, status: score.status, discussion: score.discussion, interest: score.interest },
    evidenceStatus: status,
    category: theory.category,
    updatedAt: theory.updatedAt,
    ageDays: score.ageDays,
    claimCount: theory.claimCount,
    commentCount: theory.commentCount,
  };
}
