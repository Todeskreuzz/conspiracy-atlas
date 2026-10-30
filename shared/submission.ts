import { CATEGORY_SLUGS, SOURCE_TYPES, ANONYMOUS_NAME } from './constants';
import type { SubmissionInput } from './types';
import { sanitizeRichDoc, plainText } from './richtext';
import { ValidationError, arr, int, oneOf, optStr, reqStr, url, slugify } from './validation';

export const LIMITS = {
  title: 160,
  subtitle: 200,
  summary: 1000,
  bodyChars: 60000,
  displayName: 40,
  tags: 12,
  sources: 30,
  documentLinks: 20,
  counterArguments: 20,
  relatedEvents: 20,
  relatedTheories: 20,
};

/** Validates a community submission. Shared by the editor (pre-check) and the API (authoritative). */
export function validateSubmission(input: Record<string, unknown>): SubmissionInput {
  const displayMode = oneOf(input.displayMode, 'displayMode', ['named', 'anonymous'] as const);
  let displayName: string | null = null;
  if (displayMode === 'named') {
    displayName = reqStr(input.displayName, 'displayName', LIMITS.displayName, 2);
    if (displayName.toLowerCase() === ANONYMOUS_NAME.toLowerCase()) {
      throw new ValidationError('displayName', 'choose "Anonymous" as publication mode instead');
    }
  }
  const body = sanitizeRichDoc(input.body);
  const text = plainText(body);
  if (text.length < 50) throw new ValidationError('body', 'must contain at least 50 characters');
  if (text.length > LIMITS.bodyChars) throw new ValidationError('body', `must contain at most ${LIMITS.bodyChars} characters`);

  return {
    title: reqStr(input.title, 'title', LIMITS.title, 5),
    subtitle: optStr(input.subtitle, 'subtitle', LIMITS.subtitle),
    summary: reqStr(input.summary, 'summary', LIMITS.summary, 20),
    body,
    category: oneOf(input.category, 'category', CATEGORY_SLUGS),
    tags: [...new Set(arr(input.tags, 'tags', LIMITS.tags, (t, i) => reqStr(t, `tags[${i}]`, 40)))],
    sources: arr(input.sources, 'sources', LIMITS.sources, (s, i) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        title: reqStr(o.title, `sources[${i}].title`, 300),
        url: url(o.url, `sources[${i}].url`),
        publisher: optStr(o.publisher, `sources[${i}].publisher`, 200),
        sourceType: oneOf(o.sourceType ?? 'other', `sources[${i}].sourceType`, SOURCE_TYPES),
      };
    }),
    documentLinks: arr(input.documentLinks, 'documentLinks', LIMITS.documentLinks, (u, i) => url(u, `documentLinks[${i}]`, false) as string),
    counterArguments: arr(input.counterArguments, 'counterArguments', LIMITS.counterArguments, (t, i) =>
      reqStr(t, `counterArguments[${i}]`, 2000),
    ),
    relatedEvents: arr(input.relatedEvents, 'relatedEvents', LIMITS.relatedEvents, (t, i) => reqStr(t, `relatedEvents[${i}]`, 300)),
    relatedTheoryIds: [
      ...new Set(arr(input.relatedTheoryIds, 'relatedTheoryIds', LIMITS.relatedTheories, (v, i) => int(v, `relatedTheoryIds[${i}]`, { min: 1 }) as number)),
    ],
    language: oneOf(input.language ?? 'en', 'language', ['en', 'de'] as const),
    displayMode,
    displayName,
    turnstileToken: optStr(input.turnstileToken, 'turnstileToken', 4096),
  };
}

export function tagSlug(name: string): string {
  return slugify(name);
}
