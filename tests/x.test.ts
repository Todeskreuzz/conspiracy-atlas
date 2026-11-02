import { describe, it, expect } from 'vitest';
import {
  DEFAULT_X_HANDLE,
  X_LIMIT,
  X_URL_WEIGHT,
  buildXDraft,
  resolveXHandle,
  xHook,
  xWeightedLength,
  type XCaseInput,
} from '../shared/x';
import { EVIDENCE_LABEL } from '../shared/reddit';

const sample = (over: Partial<XCaseInput> = {}): XCaseInput => ({
  id: 4,
  slug: 'area-51',
  title: 'Area 51',
  summary: 'In 1955 the site was chosen for the U-2. Claims that it holds alien craft remain unverified.',
  category: 'space-ufos',
  evidenceStatus: 'unverified',
  counterArgument: 'The Air Force has described aircraft tests, not extraterrestrial craft.',
  sourceTitles: ['CIA history of the U-2'],
  score: 10,
  ...over,
});

describe('X drafts', () => {
  it('keeps every post within 280, counting the link as 23, and rotates the hook by id and date', () => {
    const draft = buildXDraft(sample(), { origin: 'https://conspiracy-atlas.pages.dev', day: '2026-11-02' });
    expect(draft.post.length).toBeLessThanOrEqual(X_LIMIT);
    expect(draft.post.length).toBe(draft.post.text.length);
    expect(draft.post.composed).not.toContain('https://');
    expect(draft.withLink.length).toBeLessThanOrEqual(X_LIMIT);
    expect(draft.withLink.length).toBe(draft.withLink.text.length + 1 + X_URL_WEIGHT);
    expect(xWeightedLength(draft.withLink.composed, draft.caseUrl)).toBe(draft.withLink.length);
    expect(draft.reply.length).toBeLessThanOrEqual(X_LIMIT);
    expect(draft.reply.composed).toContain(draft.caseUrl);
    expect(draft.post.text).toContain('Full case file, sources & counter-arguments →');
    expect(draft.post.text).toContain(EVIDENCE_LABEL.unverified);
    expect(draft.post.text).toMatch(/Claim/);
    expect(draft.hashtags).toEqual(['#ConspiracyAtlas', '#UFO']);
    expect(draft.post.text.trim().endsWith('#UFO')).toBe(true);
    expect(draft.intentUrl).toMatch(/^https:\/\/x\.com\/intent\/post\?/);
    expect(draft.intentUrl).not.toContain('url=');
    expect(draft.intentWithLinkUrl).toContain('url=');
    expect(draft.post.text).not.toMatch(/shocking|breaking|they don't want|act now/i);
    const other = buildXDraft(sample(), { origin: 'https://conspiracy-atlas.pages.dev', day: '2026-11-03' });
    expect([draft.hook, other.hook]).toContain(xHook(4, '2026-11-02'));
    const long = buildXDraft(sample({ id: 99, title: 'T'.repeat(200), summary: 'word '.repeat(80) }), { origin: 'https://x.test', day: '2026-01-01' });
    expect(long.post.length).toBeLessThanOrEqual(X_LIMIT);
    expect(long.withLink.length).toBeLessThanOrEqual(X_LIMIT);
    expect(long.reply.length).toBeLessThanOrEqual(X_LIMIT);
  });

  it('uses a year only when the file itself contains one', () => {
    const dated = buildXDraft(sample({ id: 1, summary: 'In 1955 the dry lake was selected.' }), { origin: 'https://x.test', day: '2026-11-02' });
    const undated = buildXDraft(sample({ id: 1, title: 'A file', summary: 'People repeat a claim that is not dated here.' }), { origin: 'https://x.test', day: '2026-11-02' });
    if (dated.hook === 'timeline') expect(dated.post.text).toContain('1955');
    if (undated.hook === 'timeline') expect(undated.post.text).not.toMatch(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  });

  it('defaults the handle to ConspAtlas and rejects anything X would not accept', () => {
    expect(resolveXHandle(undefined)).toEqual({ handle: DEFAULT_X_HANDLE, invalid: false });
    expect(resolveXHandle('@ConspAtlas')).toEqual({ handle: 'ConspAtlas', invalid: false });
    expect(resolveXHandle('bad handle')).toEqual({ handle: 'ConspAtlas', invalid: true });
    expect(resolveXHandle('a'.repeat(16))).toEqual({ handle: 'ConspAtlas', invalid: true });
  });
});
