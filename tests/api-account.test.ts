import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { client, makeEnv, validSubmission } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { defaultProfile, validateProfile } from '../shared/profile';

const TOKEN = 'XXXX.DUMMY.TOKEN';
const PASSWORD = 'a long secret password';

// A 1×1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const image = () => ({ data: PNG, mime: 'image/png', width: 1, height: 1, alt: null });

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

async function register(c: ReturnType<typeof client>, username = 'night_owl', extra: Record<string, unknown> = {}) {
  const r = await c.post('/api/account/register', { username, password: PASSWORD, displayName: 'Night Owl', turnstileToken: TOKEN, ...extra });
  if (r.status === 201) c.setCsrf(r.json.csrfToken);
  return r;
}

describe('accounts', () => {
  it('signs up, stays signed in and never stores the password or recovery code', async () => {
    const env = await makeEnv();
    const c = client(env);
    const r = await register(c);
    expect(r.status).toBe(201);
    expect(r.json.user).toMatchObject({ username: 'night_owl', displayName: 'Night Owl' });
    expect(r.json.recoveryCode).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect(r.headers.get('Set-Cookie')).toMatch(/__Host-ca_user=[0-9a-f]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    const me = await c.get('/api/account/me');
    expect(me.json).toMatchObject({ authenticated: true, user: { username: 'night_owl' } });
    const raw = JSON.stringify((env.DB as any).raw.prepare('SELECT * FROM users').all());
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain(r.json.recoveryCode);
    expect(raw).not.toContain(r.json.recoveryCode.replace(/-/g, ''));
  });

  it('rejects taken, reserved and malformed usernames and weak passwords', async () => {
    const env = await makeEnv();
    await register(client(env));
    expect((await register(client(env), 'NIGHT_OWL')).status).toBe(409);
    const other = client(env);
    expect((await register(other, 'admin')).status).toBe(400);
    expect((await register(other, 'a')).status).toBe(400);
    expect((await register(other, 'bad name!')).status).toBe(400);
    expect((await register(other, 'fine_name', { password: 'short' })).status).toBe(400);
    expect((await register(other, 'fine_name', { turnstileToken: '' })).status).toBe(400);
  });

  it('logs in and out; wrong passwords and locked accounts are refused', async () => {
    const env = await makeEnv();
    await register(client(env));
    const c = client(env);
    expect((await c.post('/api/account/login', { username: 'night_owl', password: 'wrong password!' })).status).toBe(401);
    expect((await c.post('/api/account/login', { username: 'nobody_here', password: PASSWORD })).status).toBe(401);
    const ok = await c.post('/api/account/login', { username: 'Night_Owl', password: PASSWORD });
    expect(ok.status).toBe(200);
    c.setCsrf(ok.json.csrfToken);
    expect((await c.get('/api/account/me')).json.authenticated).toBe(true);
    await c.post('/api/account/logout');
    expect((await c.get('/api/account/me')).json.authenticated).toBe(false);

    const admin = client(env);
    await admin.login();
    const users = (await admin.get('/api/admin/users')).json.items;
    expect(users[0]).toMatchObject({ username: 'night_owl', status: 'active' });
    expect((await admin.post(`/api/admin/users/${users[0].id}`, { action: 'lock' })).status).toBe(200);
    expect((await c.post('/api/account/login', { username: 'night_owl', password: PASSWORD })).status).toBe(403);
    expect((await c.get('/api/users/night_owl')).status).toBe(404);
  });

  it('resets a forgotten password with the recovery code and issues a new code', async () => {
    const env = await makeEnv();
    const code = (await register(client(env))).json.recoveryCode as string;
    const c = client(env);
    const bad = await c.post('/api/account/recover', { username: 'night_owl', recoveryCode: 'AAAAA-AAAAA-AAAAA-AAAAA', newPassword: 'brand new password', turnstileToken: TOKEN });
    expect(bad.status).toBe(401);
    const r = await c.post('/api/account/recover', { username: 'night_owl', recoveryCode: code.toLowerCase(), newPassword: 'brand new password', turnstileToken: TOKEN });
    expect(r.status).toBe(200);
    expect(r.json.recoveryCode).not.toBe(code);
    expect((await client(env).post('/api/account/login', { username: 'night_owl', password: 'brand new password' })).status).toBe(200);
    expect((await client(env).post('/api/account/login', { username: 'night_owl', password: PASSWORD })).status).toBe(401);
    // The old code is used up.
    expect((await c.post('/api/account/recover', { username: 'night_owl', recoveryCode: code, newPassword: 'another password', turnstileToken: TOKEN })).status).toBe(401);
  });

  it('requires the CSRF token for writes', async () => {
    const c = client(await makeEnv());
    await register(c);
    c.setCsrf('wrong');
    expect((await c.put('/api/account/profile', { displayName: 'X Y', profile: {} })).status).toBe(403);
  });

  it('can be switched off', async () => {
    const c = client(await makeEnv({ FEATURE_ACCOUNTS: 'false' }));
    const r = await register(c);
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
    expect((await c.get('/api/account/me')).json).toMatchObject({ authenticated: false, available: false });
  });
});

describe('profile pages', () => {
  it('saves the design and shows it on the public profile with favourite cases', async () => {
    const env = await makeEnv();
    const c = client(env);
    await register(c);
    const profile = {
      ...defaultProfile(),
      tagline: 'Reading declassified files since 1998',
      bio: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello archive' }] }] },
      links: [{ label: 'Blog', url: 'https://example.org/blog' }],
      theme: 'noir',
      accent: '#3366FF',
      font: 'serif',
      layout: 'sidebar',
      pattern: 'grid',
      sections: [{ key: 'favorites', visible: true }, { key: 'about', visible: true }, { key: 'links', visible: false }],
      favorites: ['watergate', 'mkultra', 'does-not-exist'],
    };
    const saved = await c.put('/api/account/profile', { displayName: 'The Night Owl', profile });
    expect(saved.status).toBe(200);
    const pub = await client(env).get('/api/users/night_owl');
    expect(pub.status).toBe(200);
    expect(pub.json).toMatchObject({ displayName: 'The Night Owl', isOwner: false, profile: { theme: 'noir', accent: '#3366ff', layout: 'sidebar' } });
    expect(pub.json.profile.sections.map((s: any) => s.key)).toEqual(['favorites', 'about', 'links', 'submissions', 'stats']);
    expect(pub.json.favorites.map((t: any) => t.slug)).toEqual(['watergate', 'mkultra']);
    const de = await client(env).get('/api/users/night_owl?lang=de');
    expect(de.json.favorites).toHaveLength(2);
    expect((await c.get('/api/users/night_owl')).json.isOwner).toBe(true);
  });

  it('rejects unsafe profile content', async () => {
    const c = client(await makeEnv());
    await register(c);
    const put = (profile: Record<string, unknown>) => c.put('/api/account/profile', { displayName: 'Night Owl', profile });
    expect((await put({ links: [{ label: 'x', url: 'javascript:alert(1)' }] })).status).toBe(400);
    expect((await put({ accent: 'red; background:url(x)' })).status).toBe(400);
    expect((await put({ theme: 'hacker' })).status).toBe(400);
    expect((await put({ bio: { type: 'doc', content: [{ type: 'script', text: 'x' }] } })).status).toBe(400);
    expect(() => validateProfile({ sections: [{ key: 'about' }, { key: 'about' }] })).toThrow();
  });

  it('hides private profiles from everybody but the owner', async () => {
    const env = await makeEnv();
    const c = client(env);
    await register(c);
    await c.put('/api/account/profile', { displayName: 'Night Owl', profile: { visibility: 'private' } });
    expect((await client(env).get('/api/users/night_owl')).status).toBe(404);
    expect((await c.get('/api/users/night_owl')).status).toBe(200);
  });

  it('keeps profile images private until an editor approves them', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    const up = await c.put('/api/account/images/avatar', { image: image() });
    expect(up.status).toBe(201);
    expect(up.json.avatar.status).toBe('pending');
    const ownUrl = up.json.avatar.url as string;
    expect((await c.get(ownUrl)).status).toBe(200);
    expect((await client(env).get(ownUrl)).status).toBe(401);
    expect((await client(env).get('/api/users/night_owl')).json.avatar).toBeNull();
    const id = ownUrl.split('/').pop();
    expect((await client(env).get(`/api/images/${id}`)).status).toBe(404);

    const admin = client(env);
    await admin.login();
    const queue = (await admin.get('/api/admin/profile-images')).json.items;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ username: 'night_owl', slot: 'avatar' });
    expect((await admin.post(`/api/admin/profile-images/${id}`, { action: 'approve' })).status).toBe(200);
    const pub = await client(env).get('/api/users/night_owl');
    expect(pub.json.avatar).toEqual({ url: `/api/images/${id}`, status: 'approved' });

    // Replacing the avatar removes the old image.
    await c.put('/api/account/images/avatar', { image: image() });
    expect((env.DB as any).raw.prepare('SELECT COUNT(*) AS n FROM images WHERE user_id IS NOT NULL').get().n).toBe(1);
    expect((await c.put('/api/account/images/banner', { image: { ...image(), mime: 'image/jpeg' } })).status).toBe(400);
  });

  it('shows "Currently unavailable!" for profile images when uploads are off', async () => {
    const c = client(await makeEnv());
    await register(c);
    const r = await c.put('/api/account/images/avatar', { image: image() });
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });

  it('lists only named, published submissions on the profile', async () => {
    const env = await makeEnv();
    const c = client(env);
    await register(c);
    const named = await c.post('/api/submissions', validSubmission({ displayMode: 'named', displayName: 'Night Owl', title: 'A named case file' }));
    const anon = await c.post('/api/submissions', validSubmission({ title: 'An anonymous case file' }));
    expect(named.status).toBe(201);
    expect(anon.status).toBe(201);
    expect((await c.get('/api/account/submissions')).json.items).toHaveLength(2);

    const admin = client(env);
    await admin.login();
    for (const id of [named.json.id, anon.json.id]) {
      await admin.post(`/api/admin/submissions/${id}/action`, { action: 'approve' });
      expect((await admin.post(`/api/admin/submissions/${id}/action`, { action: 'publish' })).status).toBe(200);
    }
    const pub = await client(env).get('/api/users/night_owl');
    expect(pub.json.submissions.map((s: any) => s.title)).toEqual(['A named case file']);
    expect(pub.json.submissions[0].theorySlug).toBeTruthy();
  });

  it('deletes the account with its images and sessions', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    await c.put('/api/account/images/banner', { image: image() });
    expect((await c.req('DELETE', '/api/account', { currentPassword: 'wrong password!' })).status).toBe(403);
    expect((await c.req('DELETE', '/api/account', { currentPassword: PASSWORD })).status).toBe(200);
    const raw = (env.DB as any).raw;
    expect(raw.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM user_sessions').get().n).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM images').get().n).toBe(0);
    expect((await client(env).get('/api/users/night_owl')).status).toBe(404);
  });

  it('changes the password and signs out other devices', async () => {
    const env = await makeEnv();
    const a = client(env);
    await register(a);
    const b = client(env);
    await b.post('/api/account/login', { username: 'night_owl', password: PASSWORD });
    expect((await a.put('/api/account/password', { currentPassword: 'nope nope nope', newPassword: 'another long one' })).status).toBe(403);
    expect((await a.put('/api/account/password', { currentPassword: PASSWORD, newPassword: 'another long one' })).status).toBe(200);
    expect((await a.get('/api/account/me')).json.authenticated).toBe(true);
    expect((await b.get('/api/account/me')).json.authenticated).toBe(false);
  });
});
