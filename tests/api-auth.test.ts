import { describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';

describe('admin authentication', () => {
  it('logs in with correct credentials and sets a hardened session cookie', async () => {
    const c = client(await makeEnv());
    const r = await c.login();
    expect(r.status).toBe(200);
    expect(r.json.csrfToken).toMatch(/^[0-9a-f]{48}$/);
    const cookie = r.headers.get('Set-Cookie')!;
    expect(cookie).toMatch(/^__Host-ca_admin=[0-9a-f]+;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    const s = await c.get('/api/admin/session');
    expect(s.json.authenticated).toBe(true);
  });

  it('rejects wrong passwords and unknown users with the same message', async () => {
    const c = client(await makeEnv());
    const a = await c.login('editor', 'wrong password');
    const b = await c.login('nobody', 'correct horse battery staple');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error.message).toBe(b.json.error.message);
  });

  it('rate-limits login attempts (5 per 15 minutes per client)', async () => {
    const env = await makeEnv();
    const c = client(env);
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    for (let i = 0; i < 5; i++) expect((await c.post('/api/admin/login', { username: 'editor', password: 'nope' }, ip)).status).toBe(401);
    const blocked = await c.post('/api/admin/login', { username: 'editor', password: 'correct horse battery staple' }, ip);
    expect(blocked.status).toBe(429);
    // A different client is not affected.
    expect((await c.post('/api/admin/login', { username: 'editor', password: 'correct horse battery staple' }, { 'CF-Connecting-IP': '198.51.100.1' })).status).toBe(200);
  });

  it('never stores the IP address in clear text', async () => {
    const env = await makeEnv();
    const c = client(env);
    await c.post('/api/admin/login', { username: 'editor', password: 'nope' }, { 'CF-Connecting-IP': '203.0.113.99' });
    const db = env.DB as unknown as { raw: { prepare(s: string): { all(): Array<Record<string, unknown>> } } };
    const rows = db.raw.prepare('SELECT * FROM rate_limits').all();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain('203.0.113.99');
  });

  it('requires a session for admin routes', async () => {
    const c = client(await makeEnv());
    expect((await c.get('/api/admin/overview')).status).toBe(401);
  });

  it('requires the CSRF token for state-changing admin requests', async () => {
    const c = client(await makeEnv());
    await c.login();
    const bad = await c.post('/api/admin/theories', { title: 'X' }, { 'X-CSRF-Token': 'forged' });
    expect(bad.status).toBe(403);
    expect(bad.json.error.code).toBe('csrf');
  });

  it('rejects cross-origin writes', async () => {
    const c = client(await makeEnv());
    const r = await c.post('/api/admin/login', { username: 'editor', password: 'x' }, { Origin: 'https://evil.example' });
    expect(r.status).toBe(403);
    const s = await c.post('/api/admin/login', { username: 'editor', password: 'x' }, { 'Sec-Fetch-Site': 'cross-site' });
    expect(s.status).toBe(403);
  });

  it('logout destroys the session', async () => {
    const c = client(await makeEnv());
    await c.login();
    await c.post('/api/admin/logout');
    expect((await c.get('/api/admin/session')).json.authenticated).toBe(false);
  });

  it('fails closed with "Currently unavailable!" when admin secrets are missing', async () => {
    for (const missing of ['ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'] as const) {
      const c = client(await makeEnv({ [missing]: undefined }));
      const r = await c.login();
      expect(r.status).toBe(503);
      expect(r.json.error.message).toMatch(/^Currently unavailable!/);
      const s = await c.get('/api/admin/session');
      expect(s.json.available).toBe(false);
    }
  });

  it('rejects a too short SESSION_SECRET', async () => {
    const c = client(await makeEnv({ SESSION_SECRET: 'short' }));
    expect((await c.login()).status).toBe(503);
  });

  it('is disabled when FEATURE_ADMIN_PANEL=false', async () => {
    const c = client(await makeEnv({ FEATURE_ADMIN_PANEL: 'false' }));
    const r = await c.login();
    expect(r.status).toBe(503);
    expect(r.json.error.state).toBe('disabled');
  });
});
