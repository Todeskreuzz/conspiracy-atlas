import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { client, makeEnv, validSubmission } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { TURNSTILE_VERIFY_URL } from '../server/security';
import { createDb } from './helpers/d1';

const original = turnstileFetch.impl;
let calls: string[] = [];
function mockTurnstile(success: boolean | 'error') {
  turnstileFetch.impl = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    if (success === 'error') throw new Error('network down');
    return new Response(JSON.stringify({ success }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  mockTurnstile(true);
});
afterEach(() => {
  turnstileFetch.impl = original;
});

describe('community submissions', () => {
  it('accepts an anonymous submission into the moderation queue', async () => {
    const env = await makeEnv();
    const c = client(env);
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(201);
    expect(r.json.status).toBe('pending_review');
    expect(r.json.authorName).toBe('Anonymous');
    expect(calls).toEqual([TURNSTILE_VERIFY_URL]);
    // Not public before moderation.
    const list = await c.get('/api/theories?q=Lost%20Archive');
    expect(list.json.items).toHaveLength(0);
  });

  it('accepts a named submission and stores only the chosen display name', async () => {
    const env = await makeEnv();
    const c = client(env);
    const r = await c.post('/api/submissions', validSubmission({ displayMode: 'named', displayName: 'Jane Researcher' }), { 'CF-Connecting-IP': '192.0.2.44' });
    expect(r.status).toBe(201);
    expect(r.json.authorName).toBe('Jane Researcher');
    const raw = (env.DB as any).raw;
    const author = raw.prepare('SELECT * FROM authors ORDER BY id DESC LIMIT 1').get();
    expect(Object.keys(author).sort()).toEqual(['created_at', 'display_name', 'id', 'is_anonymous'].sort());
    const dump = JSON.stringify(raw.prepare('SELECT * FROM community_submissions').all());
    expect(dump).not.toContain('192.0.2.44');
  });

  it('rejects "Anonymous" as a chosen name and invalid input', async () => {
    const c = client(await makeEnv());
    expect((await c.post('/api/submissions', validSubmission({ displayMode: 'named', displayName: 'Anonymous' }))).status).toBe(400);
    expect((await c.post('/api/submissions', validSubmission({ title: '' }))).status).toBe(400);
    expect((await c.post('/api/submissions', validSubmission({ category: 'nope' }))).status).toBe(400);
    const xss = await c.post('/api/submissions', validSubmission({ sources: [{ title: 'x', url: 'javascript:alert(1)', publisher: '', sourceType: 'book' }] }));
    expect(xss.status).toBe(400);
  });

  it('rejects disallowed rich-text nodes and drops unsafe links', async () => {
    const env = await makeEnv();
    const c = client(env);
    const text = 'Click me now please, this is long enough to pass fifty chars';
    const withImage = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, { type: 'image', attrs: { src: 'https://evil.example/x.png' } }] };
    expect((await c.post('/api/submissions', validSubmission({ body: withImage }))).status).toBe(400);
    const badLink = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] };
    const r = await c.post('/api/submissions', validSubmission({ body: badLink }));
    if (r.status === 201) {
      const stored = (env.DB as any).raw.prepare('SELECT body_json FROM community_submissions WHERE id = ?').get(r.json.id).body_json;
      expect(stored).not.toContain('javascript:');
    } else {
      expect(r.status).toBe(400);
    }
  });

  it('fails when Turnstile rejects the token', async () => {
    mockTurnstile(false);
    const c = client(await makeEnv());
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('turnstile_failed');
  });

  it('fails closed with "Currently unavailable!" when Turnstile is unreachable', async () => {
    mockTurnstile('error');
    const c = client(await makeEnv());
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });

  it('shows the exact message when Turnstile is not configured and never calls it', async () => {
    const c = client(await makeEnv({ FEATURE_TURNSTILE: 'false' }));
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(503);
    expect(r.json.error.message).toBe('Currently unavailable! Anti-spam verification has not been configured.');
    expect(calls).toHaveLength(0);
    const s = await c.get('/api/status');
    expect(s.json.features.community_submissions.available).toBe(false);
    expect(s.json.features.turnstile.available).toBe(false);
  });

  it('is disabled by FEATURE_COMMUNITY_SUBMISSIONS=false', async () => {
    const c = client(await makeEnv({ FEATURE_COMMUNITY_SUBMISSIONS: 'false' }));
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(503);
    expect(r.json.error.state).toBe('disabled');
  });

  it('rate-limits submissions (5 per hour per client)', async () => {
    const c = client(await makeEnv());
    const ip = { 'CF-Connecting-IP': '203.0.113.5' };
    for (let i = 0; i < 5; i++) expect((await c.post('/api/submissions', validSubmission(), ip)).status).toBe(201);
    expect((await c.post('/api/submissions', validSubmission(), ip)).status).toBe(429);
  });

  it('accepts reports for moderation', async () => {
    const env = await makeEnv();
    const c = client(env);
    const r = await c.post('/api/reports', { targetType: 'theory', targetId: 1, reason: 'misinformation', details: 'Wrong date', turnstileToken: 'tok' });
    expect(r.status).toBe(201);
    expect((env.DB as any).raw.prepare('SELECT COUNT(*) AS n FROM reports').get().n).toBe(1);
  });
});

describe('uploads (R2 is forbidden)', () => {
  it('always answers with the disabled message and never stores a file', async () => {
    const c = client(await makeEnv({ FEATURE_COMMUNITY_UPLOADS: 'true' }));
    for (const path of ['/api/uploads', '/api/uploads/image']) {
      const r = await c.post(path, { file: 'data' });
      expect(r.status).toBe(503);
      expect(r.json.error.message).toBe('Currently unavailable! File storage is intentionally disabled in the free-only configuration.');
    }
    const s = await c.get('/api/status');
    expect(s.json.features.community_uploads.available).toBe(false);
    expect(s.json.features.community_uploads.state).toBe('disabled');
  });
});

describe('database failures', () => {
  it('maps a missing D1 binding to "Currently unavailable!" on every data endpoint', async () => {
    const c = client(await makeEnv({}, null));
    for (const path of ['/api/theories', '/api/theories/watergate', '/api/events', '/api/boards/main', '/api/map', '/api/search?q=x']) {
      const r = await c.get(path);
      expect(r.status, path).toBe(503);
      expect(r.json.error.message, path).toMatch(/^Currently unavailable!/);
    }
    const s = await c.get('/api/status');
    expect(s.status).toBe(200);
    expect(s.json.features.database.state).toBe('not_configured');
  });

  it('reports "Free usage limit reached" when D1 quota is exhausted', async () => {
    const db = createDb();
    const c = client(await makeEnv({}, db));
    db.failWith = new Error('D1_ERROR: Exceeded daily rows read limit (free plan)');
    const r = await c.get('/api/theories');
    expect(r.status).toBe(429);
    expect(r.json.error.state).toBe('limit_reached');
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });

  it('reports a temporary error for other D1 failures', async () => {
    const db = createDb();
    const c = client(await makeEnv({}, db));
    db.failWith = new Error('D1_ERROR: Network connection lost.');
    const r = await c.get('/api/events');
    expect(r.status).toBe(503);
    expect(r.json.error.message).toBe('Currently unavailable! The database service is temporarily unavailable.');
    const h = await c.get('/api/health');
    expect(h.json.ok).toBe(false);
  });

  it('does not report fake success for a submission when the database fails', async () => {
    const db = createDb();
    const c = client(await makeEnv({}, db));
    db.failWith = new Error('D1_ERROR: Network connection lost.');
    const r = await c.post('/api/submissions', validSubmission());
    expect(r.status).toBe(503);
    expect(r.json.id).toBeUndefined();
  });
});

vi.setConfig({ testTimeout: 20000 });
