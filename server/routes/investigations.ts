import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../http';
import { readJson } from '../http';
import { Db } from '../db';
import { requireFeature } from '../features';
import { sha256Hex, randomToken } from '../crypto';
import { ApiError, notFound } from '../errors';
import { assertSameOrigin, rateLimit } from '../security';
import { INVESTIGATION_NOTE_KINDS } from '../../shared/constants';
import { int, isoDateOrYear, oneOf, optStr, reqStr, url } from '../../shared/validation';
import { loadBoardContent } from '../repo';
import { MAX_NODES_PER_PRIVATE_BOARD, addEdge, addNode, deleteEdge, deleteNode, savePositions } from '../boards';

/**
 * Investigation Mode: private research projects.
 * Ownership is proven with a random key that only the visitor's browser knows (X-Investigation-Key).
 * The server stores only its SHA-256 hash. Nothing here is ever public unless the visitor
 * explicitly submits it through the moderated community form.
 */
export const investigationRoutes = new Hono<AppEnv>();

const MAX_INVESTIGATIONS = 50;
const MAX_NOTES = 500;

async function ownerHash(c: Ctx): Promise<string> {
  const key = c.req.header('X-Investigation-Key') ?? '';
  if (!/^[0-9a-f]{64}$/.test(key)) throw new ApiError(401, 'unauthorized', 'Missing or invalid investigation key');
  return sha256Hex(`investigation|${key}`);
}

function guardWrite(c: Ctx) {
  if (c.req.method !== 'GET') assertSameOrigin(c.req.raw);
}

async function loadOwned(db: Db, c: Ctx) {
  const id = int(c.req.param('id'), 'id', { min: 1 }) as number;
  const row = await db.first(
    `SELECT i.*, b.id AS board_id, b.slug AS board_slug FROM investigations i
     JOIN boards b ON b.investigation_id = i.id WHERE i.id = ? AND i.owner_key_hash = ?`,
    id,
    await ownerHash(c),
  );
  if (!row) throw notFound('Investigation');
  return row;
}

const mapInvestigation = (r: Record<string, unknown>) => ({
  id: Number(r.id),
  title: String(r.title),
  description: (r.description as string) ?? null,
  boardSlug: String(r.board_slug),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

investigationRoutes.use('/investigations/*', async (c, next) => {
  requireFeature(c.env, 'investigations');
  guardWrite(c);
  await next();
});
investigationRoutes.use('/investigations', async (c, next) => {
  requireFeature(c.env, 'investigations');
  guardWrite(c);
  await next();
});

investigationRoutes.get('/investigations', async (c) => {
  const db = Db.from(c.env);
  const rows = await db.all(
    `SELECT i.*, b.slug AS board_slug FROM investigations i JOIN boards b ON b.investigation_id = i.id
     WHERE i.owner_key_hash = ? ORDER BY i.updated_at DESC LIMIT ?`,
    await ownerHash(c),
    MAX_INVESTIGATIONS,
  );
  return c.json({ items: rows.map(mapInvestigation) });
});

investigationRoutes.post('/investigations', async (c) => {
  const db = Db.from(c.env);
  const hash = await ownerHash(c);
  const body = await readJson(c, 10_000);
  const title = reqStr(body.title, 'title', 160, 2);
  const description = optStr(body.description, 'description', 2000);
  await rateLimit(db, c.env, c.req.raw, 'investigation', 20, 3600);
  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM investigations WHERE owner_key_hash = ?', hash);
  if ((count?.n ?? 0) >= MAX_INVESTIGATIONS) throw new ApiError(400, 'limit', `At most ${MAX_INVESTIGATIONS} investigations`);
  const inv = await db.first<{ id: number }>(
    'INSERT INTO investigations (owner_key_hash, title, description) VALUES (?, ?, ?) RETURNING id',
    hash,
    title,
    description,
  );
  const slug = `inv-${randomToken(8)}`;
  await db.run("INSERT INTO boards (slug, title, visibility, investigation_id) VALUES (?, ?, 'private', ?)", slug, title, inv?.id);
  return c.json({ id: inv?.id, title, description, boardSlug: slug }, 201);
});

investigationRoutes.get('/investigations/:id', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const notes = await db.all('SELECT * FROM investigation_notes WHERE investigation_id = ? ORDER BY created_at LIMIT ?', inv.id, MAX_NOTES);
  return c.json({
    ...mapInvestigation(inv),
    notes: notes.map((n) => ({
      id: Number(n.id),
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      url: n.url ?? null,
      eventDate: n.event_date ?? null,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    })),
  });
});

investigationRoutes.patch('/investigations/:id', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const body = await readJson(c, 10_000);
  const title = reqStr(body.title ?? inv.title, 'title', 160, 2);
  const description = body.description === undefined ? (inv.description as string | null) : optStr(body.description, 'description', 2000);
  await db.batch([
    db.stmt("UPDATE investigations SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?", title, description, inv.id),
    db.stmt('UPDATE boards SET title = ? WHERE id = ?', title, inv.board_id),
  ]);
  return c.json({ ok: true });
});

investigationRoutes.delete('/investigations/:id', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  await db.run('DELETE FROM investigations WHERE id = ?', inv.id);
  return c.json({ ok: true });
});

function parseNote(body: Record<string, unknown>) {
  return {
    kind: oneOf(body.kind, 'kind', INVESTIGATION_NOTE_KINDS),
    title: reqStr(body.title, 'title', 200),
    body: optStr(body.body, 'body', 20000),
    url: url(body.url, 'url'),
    eventDate: isoDateOrYear(body.eventDate, 'eventDate'),
  };
}

investigationRoutes.post('/investigations/:id/notes', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const note = parseNote(await readJson(c, 50_000));
  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM investigation_notes WHERE investigation_id = ?', inv.id);
  if ((count?.n ?? 0) >= MAX_NOTES) throw new ApiError(400, 'limit', `At most ${MAX_NOTES} notes`);
  const row = await db.first<{ id: number }>(
    'INSERT INTO investigation_notes (investigation_id, kind, title, body, url, event_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    inv.id,
    note.kind,
    note.title,
    note.body,
    note.url,
    note.eventDate,
  );
  await db.run("UPDATE investigations SET updated_at = datetime('now') WHERE id = ?", inv.id);
  return c.json({ id: row?.id, ...note }, 201);
});

investigationRoutes.patch('/investigations/:id/notes/:noteId', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const note = parseNote(await readJson(c, 50_000));
  const r = await db.run(
    "UPDATE investigation_notes SET kind = ?, title = ?, body = ?, url = ?, event_date = ?, updated_at = datetime('now') WHERE id = ? AND investigation_id = ?",
    note.kind,
    note.title,
    note.body,
    note.url,
    note.eventDate,
    int(c.req.param('noteId'), 'noteId', { min: 1 }),
    inv.id,
  );
  if (!r.changes) throw notFound('Note');
  return c.json({ ok: true });
});

investigationRoutes.delete('/investigations/:id/notes/:noteId', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const r = await db.run('DELETE FROM investigation_notes WHERE id = ? AND investigation_id = ?', int(c.req.param('noteId'), 'noteId', { min: 1 }), inv.id);
  if (!r.changes) throw notFound('Note');
  return c.json({ ok: true });
});

investigationRoutes.get('/investigations/:id/board', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  const content = await loadBoardContent(db, Number(inv.board_id), c.get('locale'));
  return c.json({ id: inv.board_id, slug: inv.board_slug, title: inv.title, description: inv.description ?? null, ...content });
});

investigationRoutes.post('/investigations/:id/board/nodes', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  return c.json(await addNode(db, Number(inv.board_id), await readJson(c, 10_000), MAX_NODES_PER_PRIVATE_BOARD), 201);
});

investigationRoutes.delete('/investigations/:id/board/nodes/:nodeId', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  await deleteNode(db, Number(inv.board_id), int(c.req.param('nodeId'), 'nodeId', { min: 1 }) as number);
  return c.json({ ok: true });
});

investigationRoutes.put('/investigations/:id/board/positions', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  return c.json(await savePositions(db, Number(inv.board_id), await readJson(c)));
});

// Connections on private boards are always "suggested": own hypotheses never appear as documented facts.
investigationRoutes.post('/investigations/:id/board/edges', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  return c.json(await addEdge(db, Number(inv.board_id), await readJson(c, 5_000), 'suggested'), 201);
});

investigationRoutes.delete('/investigations/:id/board/edges/:edgeId', async (c) => {
  const db = Db.from(c.env);
  const inv = await loadOwned(db, c);
  await deleteEdge(db, Number(inv.board_id), int(c.req.param('edgeId'), 'edgeId', { min: 1 }) as number);
  return c.json({ ok: true });
});
