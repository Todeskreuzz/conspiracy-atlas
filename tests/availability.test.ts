import { describe, it, expect } from 'vitest';
import { FEATURE_KEYS, GENERIC_UNAVAILABLE_EXPLANATION, UNAVAILABLE_MESSAGE, backendUnavailableMap, explainDe, makeStatus, unavailableMessage } from '../shared/availability';
import { computeFeatures } from '../server/features';
import { client, makeEnv } from './helpers/app';

describe('feature status system', () => {
  it('uses the exact fixed status text', () => {
    expect(UNAVAILABLE_MESSAGE).toBe('Currently unavailable!');
    expect(GENERIC_UNAVAILABLE_EXPLANATION).toBe('This feature is temporarily unavailable because its free service limit has been reached or the required service is not configured.');
    expect(unavailableMessage('community_uploads', 'disabled')).toBe('Currently unavailable! File storage is intentionally disabled in the free-only configuration.');
    expect(unavailableMessage('turnstile', 'not_configured')).toBe('Currently unavailable! Anti-spam verification has not been configured.');
    expect(unavailableMessage('database', 'backend_unavailable')).toBe('Currently unavailable! The database service is temporarily unavailable.');
  });

  it('every non-available state carries a message and a German explanation', () => {
    for (const key of FEATURE_KEYS) {
      for (const state of ['not_configured', 'disabled', 'limit_reached', 'temporary_error', 'not_activated', 'backend_unavailable'] as const) {
        const s = makeStatus(key, state);
        expect(s.available).toBe(false);
        expect(s.message!.startsWith('Currently unavailable!')).toBe(true);
        expect(explainDe(key, state).length).toBeGreaterThan(10);
      }
    }
  });

  it('reflects the default free-only configuration', async () => {
    const f = computeFeatures(await makeEnv({ FEATURE_TURNSTILE: 'false', TURNSTILE_SECRET_KEY: undefined, TURNSTILE_SITE_KEY: undefined }));
    expect(f.database.available).toBe(true);
    expect(f.community_uploads.state).toBe('disabled');
    expect(f.automatic_import.available).toBe(false);
    expect(f.turnstile.available).toBe(false);
    expect(f.community_submissions.available).toBe(false);
    expect(f.map_data.available).toBe(true);
  });

  it('treats a missing Turnstile secret as not configured', async () => {
    const f = computeFeatures(await makeEnv({ TURNSTILE_SECRET_KEY: undefined }));
    expect(f.turnstile.state).toBe('not_configured');
    expect(f.community_submissions.available).toBe(false);
  });

  it('image uploads need the flag, submissions and Turnstile', async () => {
    expect(computeFeatures(await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' })).community_uploads.state).toBe('available');
    expect(computeFeatures(await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'false' })).community_uploads.state).toBe('disabled');
    expect(computeFeatures(await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true', FEATURE_COMMUNITY_SUBMISSIONS: 'false' })).community_uploads.state).toBe('disabled');
    const noTurnstile = computeFeatures(await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true', TURNSTILE_SECRET_KEY: undefined })).community_uploads;
    expect(noTurnstile.state).toBe('not_configured');
    expect(noTurnstile.message).toBe('Currently unavailable! Anti-spam verification has not been configured.');
  });

  it('the client fallback map marks everything unavailable', () => {
    const m = backendUnavailableMap();
    expect(Object.values(m).every((s) => !s.available)).toBe(true);
  });

  it('/api/status exposes only public configuration', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/status');
    const text = JSON.stringify(r.json);
    expect(text).toContain('1x00000000000000000000AA'); // public site key
    expect(text).not.toContain('1x0000000000000000000000000000000AA'); // secret key
    expect(text).not.toContain('pbkdf2');
    expect(text).not.toContain('x'.repeat(40));
  });

  it('security headers are set on API responses', async () => {
    const c = client(await makeEnv());
    const r = await c.get('/api/theories');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const admin = await c.get('/api/admin/session');
    expect(admin.headers.get('Cache-Control')).toContain('no-store');
  });
});
