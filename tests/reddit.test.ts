import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import en from '../src/i18n/locales/en.json';
import {
  CATEGORY_LABEL,
  DEFAULT_REDDIT_SUBREDDIT,
  EVIDENCE_LABEL,
  REDDIT_TITLE_MAX,
  buildRedditDraft,
  rankRedditCases,
  redditSubmitUrl,
  resolveSubreddit,
  scoreRedditCase,
  type RedditCase,
} from '../shared/reddit';
import { SITEMAP_PAGES } from '../server/seo';

const NOW = new Date('2026-11-02T12:00:00Z');

function counts(over: Partial<RedditCase> = {}): RedditCase {
  return {
    id: 7,
    slug: 'example-claim',
    title: 'Example Claim',
    subtitle: 'A short subtitle',
    summary: 'Some people say the moon is hollow. The case file records that claim and nothing more.',
    category: 'space-ufos',
    evidenceStatus: 'unverified',
    updatedAt: '2026-11-01 12:00:00',
    claims: [{ id: 1, text: 'The moon is hollow.', evidenceStatus: 'unverified' }],
    counterArguments: ['Seismic records show a layered interior.'],
    sourceTitles: ['NASA lunar seismic report'],
    claimCount: 1,
    counterCount: 1,
    connectionCount: 2,
    commentCount: 0,
    voteCount: 0,
    sourceCount: 1,
    ...over,
  };
}

describe('reddit draft text', () => {
  it('uses the English evidence labels and category names from the interface', () => {
    expect(EVIDENCE_LABEL).toEqual(en.status);
    expect(CATEGORY_LABEL).toEqual(en.categories);
  });

  it('writes a neutral English post with a title, evidence label, questions and a case link', () => {
    const draft = buildRedditDraft(counts(), { origin: 'https://conspiracy-atlas.pages.dev', subreddit: 'ConspiracyAtlas', now: NOW });
    expect(draft.title.length).toBeLessThanOrEqual(REDDIT_TITLE_MAX);
    expect(draft.title).not.toMatch(/shocking|you won't believe|wake up/i);
    expect(draft.body).toContain('**Evidence label on the file:** Unverified');
    expect(draft.body).toContain('not a finding');
    expect(draft.body).toContain('The moon is hollow.');
    expect(draft.body).toContain('*(Unverified)*');
    expect(draft.body).toContain('### Open questions');
    expect(draft.body).toContain('https://conspiracy-atlas.pages.dev/theory/example-claim');
    expect(draft.body).toContain('https://conspiracy-atlas.pages.dev/');
    expect(draft.body).toContain('Disclosure');
    expect(draft.body).toContain('not to present an unproven claim as fact');
    expect(draft.flair).toBe('UFOs & space');
    expect(draft.submitUrl).toMatch(/^https:\/\/www\.reddit\.com\/r\/ConspiracyAtlas\/submit\?/);
    expect(draft.submitMode).toBe('full');
    expect(draft.submitUrl).toContain('title=');
    expect(draft.submitUrl).toContain('text=');
    for (const re of [/shocking/i, /you won.t believe/i, /wake up/i, /they don.t want/i, /proven fact/i, /the truth is/i]) {
      expect(draft.body).not.toMatch(re);
      expect(draft.title).not.toMatch(re);
    }
  });

  it('keeps a very long title inside Reddit\'s limit and drops a huge body from the submit link', () => {
    const long = buildRedditDraft(counts({ id: 3, title: 'X'.repeat(400), summary: 'Y'.repeat(4000), evidenceStatus: 'disputed' }), {
      origin: 'https://conspiracy-atlas.pages.dev',
      subreddit: 'ConspiracyAtlas',
      now: NOW,
    });
    expect(long.title.length).toBeLessThanOrEqual(REDDIT_TITLE_MAX);
    expect(long.title.endsWith('…') || long.title.includes('Disputed')).toBe(true);
    const huge = redditSubmitUrl('ConspiracyAtlas', 'Short title', 'Z'.repeat(9000));
    expect(huge.mode).toBe('title-only');
    expect(huge.url).not.toContain('text=');
    expect(new URL(huge.url).searchParams.get('title')).toBe('Short title');
  });

  it('defaults to r/ConspiracyAtlas and rejects a name Reddit would not accept', () => {
    expect(resolveSubreddit(undefined)).toEqual({ name: DEFAULT_REDDIT_SUBREDDIT, invalid: false });
    expect(resolveSubreddit('  ConspiracyAtlas  ')).toEqual({ name: 'ConspiracyAtlas', invalid: false });
    expect(resolveSubreddit('Atlas_Talk')).toEqual({ name: 'Atlas_Talk', invalid: false });
    expect(resolveSubreddit('no spaces')).toEqual({ name: 'ConspiracyAtlas', invalid: true });
    expect(resolveSubreddit('ab')).toEqual({ name: 'ConspiracyAtlas', invalid: true });
    const link = redditSubmitUrl('ConspiracyAtlas', 'A title?', 'Line one\n\nLine two');
    expect(link.url.startsWith('https://www.reddit.com/r/ConspiracyAtlas/submit?')).toBe(true);
    const params = new URL(link.url).searchParams;
    expect(params.get('title')).toBe('A title?');
    expect(params.get('text')).toBe('Line one\n\nLine two');
  });
});

describe('reddit ranking', () => {
  const base = {
    claimCount: 0,
    counterCount: 0,
    connectionCount: 0,
    commentCount: 0,
    voteCount: 0,
  };

  it('ranks a recent disputed file above a recent documented one, and discussion above a small age gap', () => {
    const freshDocumented = scoreRedditCase({ ...base, updatedAt: '2026-11-02 12:00:00', evidenceStatus: 'historically_documented' }, NOW);
    const freshDisputed = scoreRedditCase({ ...base, updatedAt: '2026-11-02 12:00:00', evidenceStatus: 'disputed' }, NOW);
    const discussed = scoreRedditCase(
      { ...base, updatedAt: '2026-10-19 12:00:00', evidenceStatus: 'disputed', claimCount: 4, counterCount: 2, connectionCount: 3, commentCount: 8, voteCount: 4 },
      NOW,
    );
    const ancient = scoreRedditCase({ ...base, updatedAt: '2010-01-01 00:00:00', evidenceStatus: 'historically_documented' }, NOW);
    expect(freshDisputed.total).toBeGreaterThan(freshDocumented.total);
    expect(discussed.total).toBeGreaterThan(freshDocumented.total);
    expect(freshDisputed.total).toBeGreaterThan(ancient.total);
    expect(freshDisputed.recency).toBeGreaterThan(discussed.recency);
    expect(discussed.interest).toBeGreaterThan(0);

    const ranked = rankRedditCases(
      [
        { id: 1, updatedAt: '2026-11-02 12:00:00', evidenceStatus: 'historically_documented' as const, ...base },
        { id: 2, updatedAt: '2026-10-19 12:00:00', evidenceStatus: 'disputed' as const, ...base, claimCount: 4, counterCount: 2, connectionCount: 3, commentCount: 8, voteCount: 4 },
      ],
      NOW,
    );
    expect(ranked.map((c) => c.id)).toEqual([2, 1]);
  });
});

describe('reddit drafts stay out of public discovery', () => {
  it('is not a sitemap page, and robots already blocks the admin path', () => {
    expect(SITEMAP_PAGES.some((p) => p.includes('admin') || p.includes('reddit'))).toBe(false);
    const robots = readFileSync('public/robots.txt', 'utf8');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /de/admin');
    expect(robots).toContain('Disallow: /api/admin/');
    expect(readFileSync('public/_headers', 'utf8')).toContain('X-Robots-Tag: noindex, nofollow');
  });
});
