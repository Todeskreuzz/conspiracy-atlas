import { FEATURE_KEYS, makeStatus, type FeatureKey, type FeatureStatusMap, type ServiceState } from '../shared/availability';
import { flag, type Env } from './env';
import { UnavailableError } from './errors';

export function turnstileConfigured(env: Env): boolean {
  return flag(env.FEATURE_TURNSTILE) && !!env.TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY;
}

export function adminConfigured(env: Env): boolean {
  return !!env.ADMIN_USERNAME && !!env.ADMIN_PASSWORD_HASH && !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 32;
}

/**
 * Computes the state of every feature from configuration alone (no database calls),
 * so the status endpoint is cheap. `dbState` can override the database state after a failed query.
 */
export function computeFeatures(env: Env, dbState: ServiceState = 'available'): FeatureStatusMap {
  const database: ServiceState = env.DB ? dbState : 'not_configured';
  const needsDb = (s: ServiceState): ServiceState => (database !== 'available' ? database : s);

  const states: Record<FeatureKey, ServiceState> = {
    database,
    // Uploads are hard-wired off: there is no object storage binding in the free-only architecture.
    community_uploads: 'disabled',
    turnstile: !flag(env.FEATURE_TURNSTILE) ? 'disabled' : turnstileConfigured(env) ? 'available' : 'not_configured',
    community_submissions: !flag(env.FEATURE_COMMUNITY_SUBMISSIONS, true)
      ? 'disabled'
      : !turnstileConfigured(env)
        ? 'not_configured'
        : needsDb('available'),
    reports: !flag(env.FEATURE_REPORTS, true) ? 'disabled' : !turnstileConfigured(env) ? 'not_configured' : needsDb('available'),
    admin_panel: !flag(env.FEATURE_ADMIN_PANEL, true) ? 'disabled' : !adminConfigured(env) ? 'not_configured' : needsDb('available'),
    map_data: !flag(env.FEATURE_MAP_DATA, true) ? 'disabled' : 'available',
    automatic_import: flag(env.FEATURE_AUTOMATIC_IMPORT) ? 'not_activated' : 'disabled',
    investigations: !flag(env.FEATURE_INVESTIGATIONS, true) ? 'disabled' : needsDb('available'),
  };

  const map = {} as FeatureStatusMap;
  for (const key of FEATURE_KEYS) map[key] = makeStatus(key, states[key]);
  // Turnstile is required for submissions: if it is missing, explain that specifically.
  if (states.community_submissions === 'not_configured') map.community_submissions = { ...map.turnstile, key: 'community_submissions', state: 'not_configured', available: false };
  if (states.reports === 'not_configured') map.reports = { ...map.turnstile, key: 'reports', state: 'not_configured', available: false };
  return map;
}

/** Throws "Currently unavailable!" (fail closed) if the feature is not available. */
export function requireFeature(env: Env, key: FeatureKey): void {
  const status = computeFeatures(env)[key];
  if (!status.available) {
    throw new UnavailableError(key === 'community_submissions' || key === 'reports' ? (status.state === 'not_configured' ? 'turnstile' : key) : key, status.state);
  }
}
