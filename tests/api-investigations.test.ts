import { describe, it, expect } from 'vitest';
import { client, makeEnv } from './helpers/app';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const as = (key: string) => ({ 'X-Investigation-Key': key });

describe('investigation mode', () => {
  it('keeps projects private to the key that created them', async () => {
    const env = await makeEnv();
    const c = client(env);
    const created = await c.post('/api/investigations', { title: 'My research', description: 'Private' }, as(KEY_A));
    expect(created.status).toBe(201);
    const id = created.json.id;
    expect((await c.get('/api/investigations', as(KEY_A))).json.items).toHaveLength(1);
    expect((await c.get('/api/investigations', as(KEY_B))).json.items).toHaveLength(0);
    expect((await c.get(`/api/investigations/${id}`, as(KEY_B))).status).toBe(404);
    expect((await c.get(`/api/investigations/${id}`)).status).toBe(401);
    // The private board is not reachable through the public board endpoint.
    expect((await c.get(`/api/boards/${created.json.boardSlug}`)).status).toBe(404);
    // Only a hash of the key is stored.
    expect(JSON.stringify((env.DB as any).raw.prepare('SELECT * FROM investigations').all())).not.toContain(KEY_A);
  });

  it('stores notes, hypotheses, sources and timeline entries', async () => {
    const c = client(await makeEnv());
    const id = (await c.post('/api/investigations', { title: 'Notes test' }, as(KEY_A))).json.id;
    const kinds = ['note', 'hypothesis', 'source', 'counter_argument', 'document_link', 'timeline_entry'];
    for (const kind of kinds) {
      const r = await c.post(`/api/investigations/${id}/notes`, { kind, title: `A ${kind}`, url: kind === 'source' ? 'https://example.org' : null, eventDate: kind === 'timeline_entry' ? '1962-03-13' : null }, as(KEY_A));
      expect(r.status, kind).toBe(201);
    }
    const detail = await c.get(`/api/investigations/${id}`, as(KEY_A));
    expect(detail.json.notes.map((n: any) => n.kind)).toEqual(kinds);
    expect((await c.post(`/api/investigations/${id}/notes`, { kind: 'note', title: 'x', url: 'javascript:alert(1)' }, as(KEY_A))).status).toBe(400);
    expect((await c.post(`/api/investigations/${id}/notes`, { kind: 'note', title: 'x' }, as(KEY_B))).status).toBe(404);
  });

  it('private board threads are always "suggested", never documented facts', async () => {
    const c = client(await makeEnv());
    const id = (await c.post('/api/investigations', { title: 'Board test' }, as(KEY_A))).json.id;
    const n1 = await c.post(`/api/investigations/${id}/board/nodes`, { kind: 'claim', title: 'Hypothesis A', x: 0, y: 0 }, as(KEY_A));
    const n2 = await c.post(`/api/investigations/${id}/board/nodes`, { kind: 'theory', entityType: 'theory', entityId: 1, title: 'Watergate', x: 300, y: 0 }, as(KEY_A));
    const e = await c.post(`/api/investigations/${id}/board/edges`, { source: n1.json.id, target: n2.json.id, kind: 'documented', verification: 'documented' }, as(KEY_A));
    expect(e.status).toBe(201);
    const board = await c.get(`/api/investigations/${id}/board`, as(KEY_A));
    expect(board.json.edges[0].verification).toBe('suggested');
    await c.put(`/api/investigations/${id}/board/positions`, { positions: [{ id: n1.json.id, x: 42, y: 43 }] }, as(KEY_A));
    const again = await c.get(`/api/investigations/${id}/board`, as(KEY_A));
    expect(again.json.nodes.find((n: any) => n.id === n1.json.id)).toMatchObject({ x: 42, y: 43 });
  });

  it('deletes a project with all its data', async () => {
    const env = await makeEnv();
    const c = client(env);
    const id = (await c.post('/api/investigations', { title: 'Delete me' }, as(KEY_A))).json.id;
    await c.post(`/api/investigations/${id}/notes`, { kind: 'note', title: 'n' }, as(KEY_A));
    expect((await c.del(`/api/investigations/${id}`, as(KEY_A))).status).toBe(200);
    const raw = (env.DB as any).raw;
    expect(raw.prepare('SELECT COUNT(*) AS n FROM investigation_notes').get().n).toBe(0);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM boards WHERE visibility = 'private'").get().n).toBe(0);
  });

  it('can be switched off', async () => {
    const c = client(await makeEnv({ FEATURE_INVESTIGATIONS: 'false' }));
    const r = await c.get('/api/investigations', as(KEY_A));
    expect(r.status).toBe(503);
    expect(r.json.error.message).toMatch(/^Currently unavailable!/);
  });
});
