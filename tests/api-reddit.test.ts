import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { Db } from '../server/db';
import { buildSitemap } from '../server/seo';
import { buildFeed } from '../server/feed';
import { EVIDENCE_LABEL } from '../shared/reddit';
import type { EvidenceStatus } from '../shared/constants';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

const BANNED = [/shocking/i, /you won.t believe/i, /wake up/i, /they don.t want/i, /proven fact/i, /the truth is/i];

describe('owner reddit drafts', () => {
  it('serves five English drafts to the secret admin login and hides a case after it is marked posted', async () => {
    const env = await makeEnv();
    const raw = (env.DB as any).raw;
    raw.prepare("UPDATE theories SET updated_at = '2000-01-01 00:00:00'").run();
    raw.prepare("UPDATE theories SET evidence_status = 'disputed', updated_at = '2026-11-02 12:00:00' WHERE id = 1").run();
    const insert = raw.prepare("INSERT INTO comments (theory_id, body) VALUES (1, 'Worth discussing.')");
    for (let i = 0; i < 10; i++) insert.run();

    const visitor = client(env);
    expect((await visitor.get('/api/admin/reddit')).status).toBe(401);

    const admin = client(env);
    await admin.login();
    const list = await admin.get('/api/admin/reddit');
    expect(list.status).toBe(200);
    expect(list.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(list.json.subreddit).toBe('ConspiracyAtlas');
    expect(list.json.subredditInvalid).toBe(false);
    expect(list.json.drafts).toHaveLength(5);
    expect(list.json.drafts[0].theoryId).toBe(1);
    const ids = new Set(list.json.drafts.map((d: { theoryId: number }) => d.theoryId));
    expect(ids.size).toBe(5);
    for (const d of list.json.drafts) {
      expect(d.title.length).toBeLessThanOrEqual(300);
      expect(d.body).toContain(`http://localhost/theory/${d.slug}`);
      expect(d.body).toContain('Disclosure');
      expect(d.body).toContain(EVIDENCE_LABEL[d.evidenceStatus as EvidenceStatus]);
      expect(d.submitUrl).toContain('https://www.reddit.com/r/ConspiracyAtlas/submit?');
      expect(d.submitMode).toBe('full');
      expect(d.flair.length).toBeGreaterThan(0);
      for (const re of BANNED) {
        expect(d.title).not.toMatch(re);
        expect(d.body).not.toMatch(re);
      }
    }

    expect((await admin.post('/api/admin/reddit/1/posted')).status).toBe(200);
    const next = await admin.get('/api/admin/reddit');
    expect(next.json.drafts.map((d: { theoryId: number }) => d.theoryId)).not.toContain(1);
    expect(next.json.drafts).toHaveLength(5);
    expect(next.json.posted[0]).toMatchObject({ theoryId: 1, actor: 'editor' });

    expect((await admin.del('/api/admin/reddit/1/posted')).status).toBe(200);
    const back = await admin.get('/api/admin/reddit');
    expect(back.json.drafts[0].theoryId).toBe(1);

    expect((await admin.post('/api/admin/reddit/99999/posted')).status).toBe(404);
    raw.prepare('UPDATE theories SET is_published = 0 WHERE id = 1').run();
    expect((await admin.post('/api/admin/reddit/1/posted')).status).toBe(404);
  });

  it('is limited to the site owner, not an ordinary admin account', async () => {
    const env = await makeEnv();
    const owner = client(env);
    const mod = client(env);
    const reg = async (c: ReturnType<typeof client>, username: string) => {
      const r = await c.post('/api/account/register', { username, password: 'a long secret password', displayName: 'Night Owl', turnstileToken: 't' });
      expect(r.status).toBe(201);
      c.setCsrf(r.json.csrfToken);
    };
    await reg(owner, 'tim_owner');
    await reg(mod, 'helper_mod');
    const admin = client(env);
    await admin.login();
    const ids = Object.fromEntries((await admin.get('/api/admin/users')).json.items.map((u: { username: string; id: number }) => [u.username, u.id]));
    await admin.post(`/api/admin/users/${ids.tim_owner}`, { action: 'make_owner' });
    await admin.post(`/api/admin/users/${ids.helper_mod}`, { action: 'make_admin' });

    expect((await mod.get('/api/admin/reddit')).status).toBe(403);
    expect((await mod.post('/api/admin/reddit/1/posted')).status).toBe(403);
    const allowed = await owner.get('/api/admin/reddit');
    expect(allowed.status).toBe(200);
    expect(allowed.json.drafts.length).toBeGreaterThanOrEqual(5);
  });

  it('uses REDDIT_SUBREDDIT when it is a real subreddit name', async () => {
    const env = await makeEnv({ REDDIT_SUBREDDIT: 'AtlasTalk' });
    const admin = client(env);
    await admin.login();
    const list = await admin.get('/api/admin/reddit');
    expect(list.json.subreddit).toBe('AtlasTalk');
    expect(list.json.drafts[0].submitUrl).toContain('/r/AtlasTalk/submit?');
    const bad = await makeEnv({ REDDIT_SUBREDDIT: 'not a name' });
    const other = client(bad);
    await other.login();
    const fallback = await other.get('/api/admin/reddit');
    expect(fallback.json.subreddit).toBe('ConspiracyAtlas');
    expect(fallback.json.subredditInvalid).toBe(true);
  });

  it('returns fewer than five drafts when fewer cases remain, and stays out of the sitemap and the feed', async () => {
    const env = await makeEnv();
    const raw = (env.DB as any).raw;
    raw.prepare('UPDATE theories SET is_published = 0 WHERE id > 3').run();
    const admin = client(env);
    await admin.login();
    const list = await admin.get('/api/admin/reddit');
    expect(list.json.drafts).toHaveLength(3);

    const xml = await buildSitemap(Db.from(env), 'https://conspiracy-atlas.pages.dev');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('tab=reddit');
    const feed = await buildFeed(Db.from(env), 'https://conspiracy-atlas.pages.dev', 'en');
    expect(feed).not.toContain('/admin');
    expect(feed).not.toContain('reddit.com');
  });
});
