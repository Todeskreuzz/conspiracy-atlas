import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { client, makeEnv, validSubmission } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { defaultProfile, validateProfile } from '../shared/profile';

const TOKEN = 'XXXX.DUMMY.TOKEN';
const PASSWORD = 'a long secret password';

// A 1×1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// A 1×1 GIF.
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
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

  it('publishes profile images at once and lets editors delete them', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    const up = await c.put('/api/account/images/avatar', { image: image() });
    expect(up.status).toBe(201);
    const url = up.json.avatar.url as string;
    expect(up.json.avatar.status).toBe('approved');
    const anon = await client(env).get(url);
    expect(anon.status).toBe(200);
    expect(anon.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect((await client(env).get('/api/users/night_owl')).json.avatar).toEqual({ url, status: 'approved' });
    expect((await c.get('/api/account/me')).json.user.avatarUrl).toBe(url);

    // Replacing the avatar removes the old image.
    await c.put('/api/account/images/avatar', { image: image() });
    expect((env.DB as any).raw.prepare('SELECT COUNT(*) AS n FROM profile_images').get().n).toBe(1);
    expect((await c.put('/api/account/images/banner', { image: { ...image(), mime: 'image/jpeg' } })).status).toBe(400);

    const admin = client(env);
    await admin.login();
    const list = (await admin.get('/api/admin/profile-images')).json.items;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ username: 'night_owl', slot: 'avatar' });
    expect((await admin.get(list[0].url)).status).toBe(200);
    expect((await admin.del(`/api/admin/profile-images/${list[0].id}`)).status).toBe(200);
    expect((await client(env).get(`/api/images/${list[0].id}`)).status).toBe(404);
    expect((await client(env).get('/api/users/night_owl')).json.avatar).toBeNull();
  });

  it('hides the images of locked accounts', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    const url = (await c.put('/api/account/images/banner', { image: image() })).json.banner.url as string;
    const admin = client(env);
    await admin.login();
    const user = (await admin.get('/api/admin/users')).json.items[0];
    await admin.post(`/api/admin/users/${user.id}`, { action: 'lock' });
    expect((await client(env).get(url)).status).toBe(404);
  });

  it('accepts animated GIFs only for accounts an editor allowed', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    const gif = { data: GIF, mime: 'image/gif', width: 1, height: 1 };
    const refused = await c.put('/api/account/images/avatar', { image: gif });
    expect(refused.status).toBe(403);
    expect(refused.json.error.code).toBe('gif_not_allowed');
    expect((await c.get('/api/account/profile')).json.allowAnimated).toBe(false);

    const admin = client(env);
    await admin.login();
    const user = (await admin.get('/api/admin/users')).json.items[0];
    expect(user.allowAnimated).toBe(false);
    await admin.post(`/api/admin/users/${user.id}`, { action: 'allow_gif' });
    expect((await c.get('/api/account/profile')).json.allowAnimated).toBe(true);
    const ok = await c.put('/api/account/images/banner', { image: gif });
    expect(ok.status).toBe(201);
    const served = await client(env).get(ok.json.banner.url);
    expect(served.headers.get('Content-Type')).toBe('image/gif');
    // A PNG declared as GIF is refused.
    expect((await c.put('/api/account/images/avatar', { image: { ...gif, data: PNG } })).status).toBe(400);
  });

  it('gives accounts admin rights: admin area with the normal login and GIFs automatically', async () => {
    const env = await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' });
    const c = client(env);
    await register(c);
    expect((await c.get('/api/admin/overview')).status).toBe(401);
    expect((await c.get('/api/admin/session')).json.authenticated).toBe(false);

    const admin = client(env);
    await admin.login();
    const user = (await admin.get('/api/admin/users')).json.items[0];
    expect(user.isAdmin).toBe(false);
    expect((await admin.post(`/api/admin/users/${user.id}`, { action: 'make_admin' })).status).toBe(200);
    expect((await admin.get('/api/admin/users')).json.items[0].isAdmin).toBe(true);

    const session = (await c.get('/api/admin/session')).json;
    expect(session).toMatchObject({ authenticated: true, viaAccount: true, username: '@night_owl' });
    const overview = await c.get('/api/admin/overview');
    expect(overview.status).toBe(200);
    expect(overview.json.accounts).toMatchObject({ total: 1, locked: 0 });
    expect((await admin.get('/api/admin/users')).json.items[0]).toHaveProperty('avatarUrl', null);
    // Writes in the admin area use the account's CSRF token.
    expect((await c.post(`/api/admin/users/${user.id}`, { action: 'allow_gif' })).status).toBe(200);
    expect((await c.post(`/api/admin/users/${user.id}`, { action: 'allow_gif' }, { 'X-CSRF-Token': 'wrong' })).status).toBe(403);
    expect((await c.get('/api/account/me')).json.user.isAdmin).toBe(true);
    expect((await client(env).get('/api/users/night_owl')).json.isAdmin).toBe(true);

    // Admins may upload GIFs without the per-account switch.
    await admin.post(`/api/admin/users/${user.id}`, { action: 'disallow_gif' });
    expect((await c.get('/api/account/profile')).json.allowAnimated).toBe(true);
    expect((await c.put('/api/account/images/avatar', { image: { data: GIF, mime: 'image/gif', width: 1, height: 1 } })).status).toBe(201);

    await admin.post(`/api/admin/users/${user.id}`, { action: 'remove_admin' });
    expect((await c.get('/api/admin/overview')).status).toBe(401);
    expect((await c.get('/api/account/profile')).json.allowAnimated).toBe(false);
  });

  it('gives the owner the Grand Master rank, protected from account admins', async () => {
    const env = await makeEnv();
    const owner = client(env);
    await register(owner, 'tim_owner');
    const mod = client(env);
    await register(mod, 'helper_mod');
    const admin = client(env);
    await admin.login();
    const ids = Object.fromEntries((await admin.get('/api/admin/users')).json.items.map((u: { username: string; id: number }) => [u.username, u.id]));
    expect((await admin.post(`/api/admin/users/${ids.tim_owner}`, { action: 'make_owner' })).status).toBe(200);
    await admin.post(`/api/admin/users/${ids.helper_mod}`, { action: 'make_admin' });

    const listed = (await admin.get('/api/admin/users')).json.items.find((u: { id: number }) => u.id === ids.tim_owner);
    expect(listed).toMatchObject({ isOwner: true, isAdmin: true });
    expect((await client(env).get('/api/users/tim_owner')).json).toMatchObject({ rank: 'owner', isAdmin: true });
    expect((await client(env).get('/api/users/helper_mod')).json.rank).toBe('admin');
    expect((await owner.get('/api/account/me')).json.user).toMatchObject({ rank: 'owner', isAdmin: true });

    // The owner opens the admin area with the normal login and may manage owners.
    expect((await owner.get('/api/admin/session')).json).toMatchObject({ authenticated: true, canManageOwners: true });
    // An account admin can neither touch the owner nor hand out the rank.
    expect((await mod.get('/api/admin/session')).json.canManageOwners).toBe(false);
    expect((await mod.post(`/api/admin/users/${ids.tim_owner}`, { action: 'lock' })).status).toBe(403);
    expect((await mod.post(`/api/admin/users/${ids.tim_owner}`, { action: 'remove_owner' })).status).toBe(403);
    expect((await mod.del(`/api/admin/users/${ids.tim_owner}`)).status).toBe(403);
    expect((await mod.post(`/api/admin/users/${ids.helper_mod}`, { action: 'make_owner' })).status).toBe(403);
    expect((await owner.post(`/api/admin/users/${ids.helper_mod}`, { action: 'lock' })).status).toBe(200);
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
