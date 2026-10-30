/**
 * Bindings and variables available to the Pages Functions.
 * Only free services are bound: D1 (DB, also used for compressed community images). There are intentionally NO bindings for
 * R2, KV, Queues, Durable Objects, Workers AI, Vectorize or Browser Rendering.
 */
export interface Env {
  DB?: D1Database;

  // Feature switches (strings "true"/"false" from wrangler.toml [vars] or the dashboard)
  FEATURE_COMMUNITY_SUBMISSIONS?: string;
  /** Image uploads stored in D1 (compressed, capped by IMAGE_STORAGE_LIMIT_MB). */
  FEATURE_COMMUNITY_UPLOADS?: string;
  /** Total budget for uploaded images in MB (default 250, max. 400; the free D1 database holds 500 MB). */
  IMAGE_STORAGE_LIMIT_MB?: string;
  FEATURE_MAP_DATA?: string;
  FEATURE_AUTOMATIC_IMPORT?: string;
  FEATURE_TURNSTILE?: string;
  FEATURE_ADMIN_PANEL?: string;
  FEATURE_INVESTIGATIONS?: string;
  FEATURE_REPORTS?: string;

  // Public Turnstile site key (not secret) and secret key (set via `wrangler pages secret put`)
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;

  // Admin authentication (secrets, never in the frontend or the repository)
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  /** Random secret used to salt rate-limit hashes. */
  SESSION_SECRET?: string;

  /** "development" or "production"; informational only (cookies are always Secure, browsers accept them on localhost). */
  ENVIRONMENT?: string;
}

export function flag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}
