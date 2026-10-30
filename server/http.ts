import type { Context } from 'hono';
import type { Env } from './env';
import type { Locale } from '../shared/constants';
import { ApiError } from './errors';

export type AppEnv = { Bindings: Env; Variables: { locale: Locale } };
export type Ctx = Context<AppEnv>;

/** Reads a JSON body with a hard size limit (protects the 10 ms CPU budget). */
export async function readJson<T = Record<string, unknown>>(c: Ctx, maxBytes = 200_000): Promise<T> {
  const text = await c.req.text();
  if (text.length > maxBytes) throw new ApiError(413, 'too_large', 'Request body too large');
  if (!text) return {} as T;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ApiError(400, 'invalid_json', 'JSON object expected');
  return parsed as T;
}

/** Short public caching for read-only endpoints to save Worker invocations and D1 reads. */
export function publicCache(c: Ctx, seconds = 60) {
  c.header('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
}

