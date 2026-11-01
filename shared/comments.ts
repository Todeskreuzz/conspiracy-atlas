// Limits and validation for comments and votes (shared by the API and the form).
import { ValidationError } from './validation';
import type { VoteValue } from './types';

export const COMMENT_LIMITS = {
  minChars: 2,
  maxChars: 2000,
  /** Comments per account within the rate-limit window. */
  perWindow: 10,
  windowSeconds: 600,
  /** Votes per account and hour. */
  votesPerHour: 200,
  /** Most comments returned for one case. */
  maxPerCase: 500,
} as const;

/** Plain text only (rendered as text, never as HTML); collapses runs of blank lines. */
export function validateCommentBody(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('body', 'Comment text is required');
  const text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < COMMENT_LIMITS.minChars) throw new ValidationError('body', `Please write at least ${COMMENT_LIMITS.minChars} characters`);
  if (text.length > COMMENT_LIMITS.maxChars) throw new ValidationError('body', `At most ${COMMENT_LIMITS.maxChars} characters`);
  return text;
}

export function validateVote(value: unknown): VoteValue {
  if (value === 1 || value === -1 || value === 0) return value;
  throw new ValidationError('value', 'Vote must be 1, -1 or 0');
}
