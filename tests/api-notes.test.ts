import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

const source = {
  kind: 'source',
  body: 'The Church Committee final report describes the programme in detail.',
  sourceUrl: 'https://www.senate.gov/about/powers-procedures/investigations/church-committee.htm',
  sourceTitle: 'Church Committee',
  displayMode: 'named',
  displayName: 'Archivist',
  turnstileToken: 'ok',
};

describe('reader notes on case files', () => {
  it('stay hidden until an editor approves them', async () => {
    const env = await makeEnv();
    const c = client(env);
    const r = await c.post('/api/theories/cointelpro/notes', source);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('pending');
    expect((await c.get('/api/theories/cointelpro/notes')).json.items).toEqual([]);

    const admin = client(env);
    await admin.login();
    expect((await admin.get('/api/admin/overview')).json.pendingNotes).toBe(1);
    const queue = await admin.get('/api/admin/notes');
    expect(queue.json.items).toHaveLength(1);
    expect(queue.json.items[0].theory.slug).toBe('cointelpro');
    expect((await admin.post(`/api/admin/notes/${r.json.id}`, { status: 'approved' })).status).toBe(200);

    const pub = await c.get('/api/theories/cointelpro/notes');
    expect(pub.json.items).toHaveLength(1);
    expect(pub.json.items[0]).toMatchObject({ kind: 'source', authorName: 'Archivist', sourceTitle: 'Church Committee' });
    expect(pub.json.items[0].status).toBeUndefined();

    await admin.post(`/api/admin/notes/${r.json.id}`, { status: 'rejected' });
    expect((await c.get('/api/theories/cointelpro/notes')).json.items).toEqual([]);
    expect((await admin.del(`/api/admin/notes/${r.json.id}`)).status).toBe(200);
  });

  it('validates input and stores anonymous notes without a name', async () => {
    const env = await makeEnv();
    const c = client(env);
    expect((await c.post('/api/theories/cointelpro/notes', { ...source, sourceUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await c.post('/api/theories/cointelpro/notes', { ...source, sourceUrl: null })).status).toBe(400);
    expect((await c.post('/api/theories/cointelpro/notes', { ...source, body: 'short' })).status).toBe(400);
    expect((await c.post('/api/theories/does-not-exist/notes', source)).status).toBe(404);
    const anon = await c.post('/api/theories/cointelpro/notes', { kind: 'comment', body: 'A comment without any link at all.', displayMode: 'anonymous', displayName: 'Ignored', turnstileToken: 'ok' });
    expect(anon.status).toBe(201);
    const admin = client(env);
    await admin.login();
    expect((await admin.get('/api/admin/notes')).json.items[0].authorName).toBe('Anonymous');
  });

  it('require an admin session for moderation', async () => {
    const c = client(await makeEnv());
    expect((await c.get('/api/admin/notes')).status).toBe(401);
  });

  it('is unavailable when community submissions are switched off', async () => {
    const c = client(await makeEnv({ FEATURE_COMMUNITY_SUBMISSIONS: 'false' }));
    const r = await c.post('/api/theories/cointelpro/notes', source);
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.json)).toContain('Currently unavailable!');
  });
});
