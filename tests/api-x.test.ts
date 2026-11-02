import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { X_LIMIT } from '../shared/x';
import { EVIDENCE_LABEL } from '../shared/reddit';
import type { EvidenceStatus } from '../shared/constants';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

describe('owner X drafts', () => {
  it('serves the public case of the day and a separate queue from Reddit', async () => {
    const env = await makeEnv();
    const raw = (env.DB as any).raw;
    const visitor = client(env);
    expect((await visitor.get('/api/admin/x')).status).toBe(401);
    const admin = client(env);
    await admin.login();
    const list = await admin.get('/api/admin/x');
    const publicCase = await visitor.get('/api/case-of-the-day');
    expect(list.status).toBe(200);
    expect(list.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(list.json.handle).toBe('ConspAtlas');
    expect(list.json.caseOfTheDay.day).toBe(publicCase.json.day);
    expect(list.json.caseOfTheDay.draft.slug).toBe(publicCase.json.theory.slug);
    expect(list.json.caseOfTheDay.draft.post.text.startsWith('Case of the Day')).toBe(true);
    expect(list.json.drafts.length).toBeGreaterThanOrEqual(3);
    expect(list.json.drafts.length).toBeLessThanOrEqual(5);
    const cotd = list.json.caseOfTheDay.draft.theoryId;
    expect(list.json.drafts.map((d: { theoryId: number }) => d.theoryId)).not.toContain(cotd);
    for (const d of [list.json.caseOfTheDay.draft, ...list.json.drafts]) {
      expect(d.post.length).toBeLessThanOrEqual(X_LIMIT);
      expect(d.reply.length).toBeLessThanOrEqual(X_LIMIT);
      expect(d.withLink.length).toBeLessThanOrEqual(X_LIMIT);
      expect(d.post.text).toContain(EVIDENCE_LABEL[d.evidenceStatus as EvidenceStatus]);
      expect(d.post.composed).not.toContain('http');
      expect(d.reply.composed).toContain(`/theory/${d.slug}`);
      expect(d.hashtags.length).toBeLessThanOrEqual(2);
      expect(d.intentUrl).not.toContain('url=');
      expect(d.intentWithLinkUrl).toContain('url=');
    }

    const id = list.json.drafts[0].theoryId as number;
    expect((await admin.post(`/api/admin/x/${id}/posted`)).status).toBe(200);
    const next = await admin.get('/api/admin/x');
    expect(next.json.drafts.map((d: { theoryId: number }) => d.theoryId)).not.toContain(id);
    const reddit = await admin.get('/api/admin/reddit');
    const redditIds = [reddit.json.caseOfTheDay?.draft.theoryId, ...reddit.json.drafts.map((d: { theoryId: number }) => d.theoryId)];
    expect(reddit.json.posted.map((p: { theoryId: number }) => p.theoryId)).not.toContain(id);
    expect(raw.prepare('SELECT 1 AS n FROM reddit_posts WHERE theory_id = ?').get(id)).toBeUndefined();
    expect(redditIds).toContain(id);

    expect((await admin.post('/api/admin/x/daily/posted')).status).toBe(200);
    expect((await admin.get('/api/admin/x')).json.caseOfTheDay.posted).toBe(true);
    expect((await admin.get('/api/admin/reddit')).json.caseOfTheDay.posted).toBe(false);
    expect((await admin.del('/api/admin/x/daily/posted')).status).toBe(200);
    expect((await admin.get('/api/admin/x')).json.caseOfTheDay.posted).toBe(false);
  });

  it('is limited to the site owner', async () => {
    const env = await makeEnv();
    const mod = client(env);
    const r = await mod.post('/api/account/register', { username: 'helper_mod', password: 'a long secret password', displayName: 'Night Owl', turnstileToken: 't' });
    expect(r.status).toBe(201);
    mod.setCsrf(r.json.csrfToken);
    const admin = client(env);
    await admin.login();
    const id = (await admin.get('/api/admin/users')).json.items[0].id;
    await admin.post(`/api/admin/users/${id}`, { action: 'make_admin' });
    expect((await mod.get('/api/admin/x')).status).toBe(403);
    expect((await mod.post('/api/admin/x/daily/posted')).status).toBe(403);
  });

  it('uses X_HANDLE when it is a real handle', async () => {
    const env = await makeEnv({ X_HANDLE: 'Atlas_News' });
    const admin = client(env);
    await admin.login();
    expect((await admin.get('/api/admin/x')).json.handle).toBe('Atlas_News');
    const bad = client(await makeEnv({ X_HANDLE: 'no spaces' }));
    await bad.login();
    const fallback = await bad.get('/api/admin/x');
    expect(fallback.json.handle).toBe('ConspAtlas');
    expect(fallback.json.handleInvalid).toBe(true);
  });
});
