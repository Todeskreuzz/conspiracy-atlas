import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { client, makeEnv, validSubmission } from './helpers/app';
import { turnstileFetch } from '../server/routes/community';
import { BACKUP_TABLES } from '../shared/backup-core.mjs';

const original = turnstileFetch.impl;
beforeEach(() => {
  turnstileFetch.impl = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch;
});
afterEach(() => {
  turnstileFetch.impl = original;
});

async function setup() {
  const env = await makeEnv();
  const visitor = client(env);
  const admin = client(env);
  await admin.login();
  return { env, visitor, admin, raw: (env.DB as any).raw };
}

describe('moderation workflow', () => {
  it('lists pending submissions and publishes an approved one to archive and wall', async () => {
    const { visitor, admin } = await setup();
    const sub = await visitor.post('/api/submissions', validSubmission({ relatedTheoryIds: [1, 2] }));
    const queue = await admin.get('/api/admin/submissions?status=pending_review');
    expect(queue.json.items.map((s: any) => s.id)).toContain(sub.json.id);

    // Publishing straight from pending is not allowed.
    expect((await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'publish' })).status).toBe(409);
    expect((await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'approve' })).json.status).toBe('approved');
    const pub = await admin.post(`/api/admin/submissions/${sub.json.id}/action`, { action: 'publish' });
    expect(pub.status).toBe(200);
    const slug = pub.json.publishedSlug;
    expect(slug).toBe('the-lost-archive-of-example-city');

    const theory = await visitor.get(`/api/theories/${slug}`);
    expect(theory.status).toBe(200);
    expect(theory.json.origin).toBe('community');
    expect(theory.json.evidenceStatus).toBe('unverified');
    expect(theory.json.authorName).toBe('Anonymous');
    expect(theory.json.counterArguments.map((x: any) => x.text)).toContain('There is no evidence for this.');
    // Community connections are always marked as suggested.
    expect(theory.json.relationships.length).toBeGreaterThan(0);
    expect(theory.json.relationships.every((r: any) => r.verification === 'suggested')).toBe(true);

    const wall = await visitor.get('/api/boards/main');
    const node = wall.json.nodes.find((n: any) => n.entityType === 'theory' && n.entitySlug === slug);
    expect(node).toBeTruthy();
    const edges = wall.json.edges.filter((e: any) => e.source === node.id || e.target === node.id);
    expect(edges.length).toBe(2);
    expect(edges.every((e: any) => e.verification === 'suggested')).toBe(true);
  });

  it('supports reject, request changes, edit and withdraw with an audit trail', async () => {
    const { visitor, admin, raw } = await setup();
    const a = (await visitor.post('/api/submissions', validSubmission())).json.id;
    const b = (await visitor.post('/api/submissions', validSubmission({ title: 'Second submission title' }))).json.id;

    expect((await admin.post(`/api/admin/submissions/${a}/action`, { action: 'request_changes', note: 'Add sources' })).json.status).toBe('changes_requested');
    expect((await admin.patch(`/api/admin/submissions/${a}`, { ...validSubmission({ title: 'Edited title for the archive' }) })).status).toBe(200);
    expect((await admin.get(`/api/admin/submissions/${a}`)).json.title).toBe('Edited title for the archive');
    expect((await admin.post(`/api/admin/submissions/${a}/action`, { action: 'reject' })).json.status).toBe('rejected');

    await admin.post(`/api/admin/submissions/${b}/action`, { action: 'approve' });
    const slug = (await admin.post(`/api/admin/submissions/${b}/action`, { action: 'publish' })).json.publishedSlug;
    expect((await visitor.get(`/api/theories/${slug}`)).status).toBe(200);
    expect((await admin.post(`/api/admin/submissions/${b}/action`, { action: 'withdraw' })).json.status).toBe('withdrawn');
    expect((await visitor.get(`/api/theories/${slug}`)).status).toBe(404);
    const wall = await visitor.get('/api/boards/main');
    expect(wall.json.nodes.some((n: any) => n.entitySlug === slug)).toBe(false);

    const actions = raw.prepare('SELECT action FROM moderation_actions ORDER BY id').all().map((r: any) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['request_changes', 'edit', 'reject', 'approve', 'publish', 'withdraw']));
  });

  it('handles reports', async () => {
    const { visitor, admin } = await setup();
    await visitor.post('/api/reports', { targetType: 'theory', targetId: 1, reason: 'spam', turnstileToken: 't' });
    const list = await admin.get('/api/admin/reports');
    expect(list.json.items).toHaveLength(1);
    const r = await admin.post(`/api/admin/reports/${list.json.items[0].id}`, { status: 'resolved' });
    expect(r.status).toBe(200);
  });
});

describe('archive editing', () => {
  it('creates a theory with claims, sources and claim-specific evidence', async () => {
    const { visitor, admin } = await setup();
    const t = await admin.post('/api/admin/theories', {
      title: 'Test Operation',
      summary: 'A test entry used by the integration tests.',
      category: 'secret-operations',
      evidenceStatus: 'under_investigation',
      tags: ['Testing'],
    });
    expect(t.status).toBe(201);
    const claim = await admin.post(`/api/admin/theories/${t.json.id}/claims`, { text: 'A specific claim.', evidenceStatus: 'partially_supported', isFact: false });
    expect(claim.status).toBe(201);
    const src = await admin.post('/api/admin/sources', { title: 'Primary memo', sourceType: 'primary_document', isPrimary: true, url: 'https://example.org/memo.pdf' });
    expect(src.status).toBe(201);
    const ev = await admin.post('/api/admin/evidence', { theoryId: t.json.id, claimId: claim.json.id, sourceId: src.json.id, relation: 'supports' });
    expect(ev.status).toBe(201);
    // A claim of another theory cannot be used.
    const wrong = await admin.post('/api/admin/evidence', { theoryId: 1, claimId: claim.json.id, sourceId: src.json.id, relation: 'supports' });
    expect(wrong.status).toBe(400);

    const detail = await visitor.get(`/api/theories/${t.json.slug}`);
    const c = detail.json.claims.find((x: any) => x.id === claim.json.id);
    expect(c.evidence[0].source.title).toBe('Primary memo');
    expect(c.evidence[0].relation).toBe('supports');

    // Editing keeps the wall card in sync.
    await admin.put(`/api/admin/theories/${t.json.id}`, { title: 'Renamed Operation', summary: 'A test entry used by the integration tests.', category: 'secret-operations', evidenceStatus: 'disputed', tags: [] });
    const wall = await visitor.get('/api/boards/main');
    const node = wall.json.nodes.find((n: any) => n.entityType === 'theory' && n.entityId === t.json.id);
    expect(node.title).toBe('Renamed Operation');
    expect(node.evidenceStatus).toBe('disputed');
  });

  it('refuses remote image URLs (no external media)', async () => {
    const { admin } = await setup();
    const r = await admin.post('/api/admin/theories', { title: 'X theory', summary: 'Summary long enough.', category: 'history', evidenceStatus: 'unverified', imagePath: 'https://evil.example/a.png' });
    expect(r.status).toBe(400);
  });
});

describe('wall editing', () => {
  it('saves and restores card positions and threads', async () => {
    const { visitor, admin } = await setup();
    const before = await visitor.get('/api/boards/main');
    const [a, b] = before.json.nodes;
    const saved = await admin.put('/api/admin/boards/main/positions', { positions: [{ id: a.id, x: 1234, y: -567 }] });
    expect(saved.json.saved).toBe(1);
    const edge = await admin.post('/api/admin/boards/main/edges', { source: a.id, target: b.id, kind: 'thematic', label: 'Test thread', verification: 'documented' });
    expect(edge.status).toBe(201);
    const after = await visitor.get('/api/boards/main');
    const moved = after.json.nodes.find((n: any) => n.id === a.id);
    expect([moved.x, moved.y]).toEqual([1234, -567]);
    expect(after.json.edges.find((e: any) => e.id === edge.json.id).label).toBe('Test thread');
    expect((await admin.del(`/api/admin/boards/main/edges/${edge.json.id}`)).status).toBe(200);
    const node = await admin.post('/api/admin/boards/main/nodes', { kind: 'claim', title: 'Free-standing claim', x: 10, y: 20 });
    expect(node.status).toBe(201);
    expect((await admin.del(`/api/admin/boards/main/nodes/${node.json.id}`)).status).toBe(200);
  });
});

describe('services and backups', () => {
  it('reports services without inventing usage numbers', async () => {
    const { admin } = await setup();
    const r = await admin.get('/api/admin/services?counts=1');
    expect(r.json.plan).toBe('free-only');
    const d1 = r.json.services.find((s: any) => s.service === 'Cloudflare D1');
    expect(d1.state).toBe('available');
    expect(d1.lastOk).toBeTruthy();
    expect(d1.usage).toBe('Currently unavailable!');
    expect(d1.tableCounts.theories).toBe(14);
    const r2 = r.json.services.find((s: any) => s.service.startsWith('Cloudflare R2'));
    expect(r2.enabled).toBe(false);
  });

  it('exports every backup table as JSON and a table as CSV, never sessions', async () => {
    const { admin } = await setup();
    const r = await admin.get('/api/admin/export');
    expect(r.headers.get('Content-Disposition')).toContain('attachment');
    expect(Object.keys(r.json.tables)).toEqual([...BACKUP_TABLES]);
    expect(r.json.tables.theories).toHaveLength(14);
    expect(r.json.tables.admin_sessions).toBeUndefined();
    expect(r.json.tables.rate_limits).toBeUndefined();
    const csv = await admin.get('/api/admin/export?format=csv&table=sources');
    expect(csv.headers.get('Content-Type')).toContain('text/csv');
    expect(String(csv.json).split('\n')[0]).toContain('title');
    expect((await admin.get('/api/admin/export?format=csv&table=admin_sessions')).status).toBe(400);
  });
});
