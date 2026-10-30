import type { ServiceState } from '../shared/availability';
import { UNAVAILABLE_MESSAGE, explainEn } from '../shared/availability';
import type { FeatureKey } from '../shared/availability';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public state?: ServiceState,
    public field?: string,
  ) {
    super(message);
  }
}

export class UnavailableError extends ApiError {
  constructor(public feature: FeatureKey | null, state: ServiceState) {
    super(state === 'limit_reached' ? 429 : 503, 'unavailable', `${UNAVAILABLE_MESSAGE} ${explainEn(feature, state)}`, state);
  }
}

/** Maps a D1 error to an availability state. Errors are never retried in a loop. */
export function classifyDbError(err: unknown): ServiceState {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  if (/(limit|quota|exceeded|too many|maximum database size|daily)/.test(msg) && !/sql|syntax/.test(msg)) return 'limit_reached';
  if (/(no such table|not configured|binding)/.test(msg)) return 'not_configured';
  if (/(network|timeout|timed out|unavailable|reset|internal error|overloaded)/.test(msg)) return 'temporary_error';
  return 'temporary_error';
}

export const notFound = (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found`);
export const badRequest = (message: string, field?: string) => new ApiError(400, 'invalid', message, undefined, field);
export const forbidden = (message = 'Forbidden') => new ApiError(403, 'forbidden', message);
export const unauthorized = () => new ApiError(401, 'unauthorized', 'Authentication required');
