import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';

const PASSWORD = 'a long secret password';
const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

async function member(env: Awaited<ReturnType<typeof makeEnv>>, username: string) {
  const c = client(env);
  const r = await c.post('/api/account/register', { username, password: PASSWORD, displayName: username.toUpperCase(), turnstileToken: 'ok' });
  expect(r.status).toBe(201);
  c.setCsrf(r.json.csrfToken);
  return c;
}

const discussion = (c: ReturnType<typeof client>, sort = 'top') => c.get(`/api/theories/mkultra/discussion?sort=${sort}`);

describe('comments', () => {
  it('lets signed-in accounts comment and reply at once; visitors only read', async () => {
    const env = await makeEnv();
    const visitor = client(env);
    expect((await discussion(visitor)).json).toMatchObject({ comments: [], total: 0, votes: { up: 0, down: 0, myVote: 0 } });
    expect((await visitor.post('/api/theories/mkultra/comments', { body: 'Hello there' })).status).toBe(401);

    const alice = await member(env, 'alice');
    const bob = await member(env, 'bob');
    const first = await alice.post('/api/theories/mkultra/comments', { body: '  The Church Committee report is worth reading.  ', language: 'en' });
    expect(first.status).toBe(201);
    const reply = await bob.post('/api/theories/mkultra/comments', { body: 'Agreed, especially volume 1.', parentId: first.json.id });
    expect(reply.status).toBe(201);
    // A reply to a reply lands under the top-level comment.
    const nested = await alice.post('/api/theories/mkultra/comments', { body: 'Thanks!', parentId: reply.json.id });
    expect(nested.json.parentId).toBe(first.json.id);

    const d = (await discussion(visitor)).json;
    expect(d.total).toBe(3);
    expect(d.comments).toHaveLength(1);
    expect(d.comments[0]).toMatchObject({ body: 'The Church Committee report is worth reading.', author: { username: 'alice', displayName: 'ALICE' }, mine: false });
    expect(d.comments[0].replies.map((r: any) => r.author.username)).toEqual(['bob', 'alice']);
    expect(JSON.stringify(d)).not.toContain('password');
    expect((await discussion(alice)).json.comments[0].mine).toBe(true);
  });

  it('validates text, parent and case', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    expect((await alice.post('/api/theories/mkultra/comments', { body: ' ' })).status).toBe(400);
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'x'.repeat(2001) })).status).toBe(400);
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'Hello there', parentId: 999 })).status).toBe(400);
    expect((await alice.post('/api/theories/no-such-case/comments', { body: 'Hello there' })).status).toBe(404);
    const other = await alice.post('/api/theories/watergate/comments', { body: 'On another case' });
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'Wrong case parent', parentId: other.json.id })).status).toBe(400);
  });

  it('needs the CSRF token and rejects cross-site writes', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'Hello there' }, { 'X-CSRF-Token': 'wrong' })).status).toBe(403);
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'Hello there' }, { Origin: 'https://evil.example' })).status).toBe(403);
  });

  it('lets only the author edit or delete; deleted comments with replies stay as placeholders', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    const bob = await member(env, 'bob');
    const a = (await alice.post('/api/theories/mkultra/comments', { body: 'First version' })).json.id;
    expect((await bob.patch(`/api/comments/${a}`, { body: 'Hijacked' })).status).toBe(403);
    expect((await bob.del(`/api/comments/${a}`)).status).toBe(403);
    expect((await alice.patch(`/api/comments/${a}`, { body: 'Second version' })).status).toBe(200);
    let d = (await discussion(alice)).json;
    expect(d.comments[0]).toMatchObject({ body: 'Second version' });
    expect(d.comments[0].editedAt).toBeTruthy();

    await bob.post('/api/theories/mkultra/comments', { body: 'A reply', parentId: a });
    expect((await alice.del(`/api/comments/${a}`)).status).toBe(200);
    d = (await discussion(alice)).json;
    expect(d.comments[0]).toMatchObject({ deleted: true, body: '', author: null, mine: false });
    expect(d.comments[0].replies).toHaveLength(1);
    expect(d.total).toBe(1);

    // Without replies the comment is removed completely.
    const solo = (await alice.post('/api/theories/mkultra/comments', { body: 'Gone soon' })).json.id;
    await alice.del(`/api/comments/${solo}`);
    expect((env.DB as any).raw.prepare('SELECT COUNT(*) AS n FROM comments WHERE id = ?').get(solo).n).toBe(0);
  });

  it('is rate-limited per account', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    for (let i = 0; i < 10; i++) expect((await alice.post('/api/theories/mkultra/comments', { body: `Comment ${i}` })).status).toBe(201);
    expect((await alice.post('/api/theories/mkultra/comments', { body: 'One too many' })).status).toBe(429);
  });

  it('hides comments of locked accounts and lets editors hide, restore and delete', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    const id = (await alice.post('/api/theories/mkultra/comments', { body: 'Something rude' })).json.id;
    const admin = client(env);
    await admin.login();
    const res = await admin.get('/api/admin/comments');
    const list = res.json.items;
    expect(list[0]).toMatchObject({ id, status: 'visible', theory: { slug: 'mkultra' }, author: { username: 'alice' } });
    expect((await admin.post(`/api/admin/comments/${id}`, { status: 'hidden' })).status).toBe(200);
    expect((await discussion(client(env))).json.comments).toEqual([]);
    expect((await alice.patch(`/api/comments/${id}`, { body: 'Edited' })).status).toBe(403);
    expect((await admin.get('/api/admin/comments?status=hidden')).json.items).toHaveLength(1);
    await admin.post(`/api/admin/comments/${id}`, { status: 'visible' });
    expect((await discussion(client(env))).json.comments).toHaveLength(1);

    const users = (await admin.get('/api/admin/users')).json.items;
    await admin.post(`/api/admin/users/${users[0].id}`, { action: 'lock' });
    expect((await discussion(client(env))).json.comments).toEqual([]);
    expect((await admin.del(`/api/admin/comments/${id}`)).status).toBe(200);
    expect((await client(env).get('/api/admin/comments')).status).toBe(401);
  });

  it('is unavailable when accounts are switched off', async () => {
    const c = client(await makeEnv({ FEATURE_ACCOUNTS: 'false' }));
    const r = await c.get('/api/theories/mkultra/discussion');
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.json)).toContain('Currently unavailable!');
  });
});

describe('votes', () => {
  it('counts one vote per account on a case and can be changed or taken back', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    const bob = await member(env, 'bob');
    expect((await client(env).put('/api/theories/mkultra/vote', { value: 1 })).status).toBe(401);
    expect((await alice.put('/api/theories/mkultra/vote', { value: 1 })).json).toEqual({ up: 1, down: 0, myVote: 1 });
    expect((await alice.put('/api/theories/mkultra/vote', { value: 1 })).json).toEqual({ up: 1, down: 0, myVote: 1 });
    expect((await bob.put('/api/theories/mkultra/vote', { value: -1 })).json).toEqual({ up: 1, down: 1, myVote: -1 });
    expect((await alice.put('/api/theories/mkultra/vote', { value: -1 })).json).toEqual({ up: 0, down: 2, myVote: -1 });
    expect((await alice.put('/api/theories/mkultra/vote', { value: 0 })).json).toEqual({ up: 0, down: 1, myVote: 0 });
    expect((await alice.put('/api/theories/mkultra/vote', { value: 5 })).status).toBe(400);
    expect((await discussion(client(env))).json.votes).toEqual({ up: 0, down: 1, myVote: 0 });
    expect((await discussion(bob)).json.votes.myVote).toBe(-1);
  });

  it('ranks comments by votes; nobody votes on their own comment', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    const bob = await member(env, 'bob');
    const carol = await member(env, 'carol');
    const older = (await alice.post('/api/theories/mkultra/comments', { body: 'Older comment' })).json.id;
    const newer = (await alice.post('/api/theories/mkultra/comments', { body: 'Newer comment' })).json.id;
    (env.DB as any).raw.prepare("UPDATE comments SET created_at = datetime('now', '-1 hour') WHERE id = ?").run(older);
    expect((await alice.put(`/api/comments/${older}/vote`, { value: 1 })).status).toBe(400);
    expect((await bob.put(`/api/comments/${older}/vote`, { value: 1 })).json).toEqual({ up: 1, down: 0, myVote: 1 });
    await carol.put(`/api/comments/${older}/vote`, { value: 1 });
    await carol.put(`/api/comments/${newer}/vote`, { value: -1 });
    expect((await discussion(bob, 'top')).json.comments.map((c: any) => c.id)).toEqual([older, newer]);
    expect((await discussion(bob, 'new')).json.comments.map((c: any) => c.id)).toEqual([newer, older]);
    const mine = (await discussion(bob)).json.comments[0].votes;
    expect(mine).toEqual({ up: 2, down: 0, myVote: 1 });
    expect((await bob.put('/api/comments/9999/vote', { value: 1 })).status).toBe(404);
  });
});

describe('profiles', () => {
  it('show the latest visible comments and their count', async () => {
    const env = await makeEnv();
    const alice = await member(env, 'alice');
    await alice.post('/api/theories/mkultra/comments', { body: 'A comment on MKUltra that is long enough.' });
    const hidden = (await alice.post('/api/theories/watergate/comments', { body: 'Hidden later' })).json.id;
    const admin = client(env);
    await admin.login();
    await admin.post(`/api/admin/comments/${hidden}`, { status: 'hidden' });
    const p = await alice.get('/api/users/alice');
    expect(p.status).toBe(200);
    expect(p.json.stats.comments).toBe(1);
    expect(p.json.recentComments).toEqual([expect.objectContaining({ excerpt: 'A comment on MKUltra that is long enough.', theorySlug: 'mkultra' })]);
  });
});
