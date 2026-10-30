// Board editing shared by the admin (public wall) and private investigation boards.
import type { Db } from './db';
import { ApiError, notFound } from './errors';
import { NODE_KINDS, RELATION_KINDS, ENTITY_TYPES, CATEGORY_SLUGS, EVIDENCE_STATUSES } from '../shared/constants';
import type { RelationVerification } from '../shared/constants';
import { arr, int, num, oneOf, optOneOf, optStr, reqStr } from '../shared/validation';

export const MAX_NODES_PER_PRIVATE_BOARD = 300;
const COORD = 1_000_000;

export async function addNode(db: Db, boardId: number, body: Record<string, unknown>, maxNodes?: number) {
  if (maxNodes) {
    const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM board_nodes WHERE board_id = ?', boardId);
    if ((count?.n ?? 0) >= maxNodes) throw new ApiError(400, 'limit', `A board can hold at most ${maxNodes} cards`);
  }
  const kind = oneOf(body.kind, 'kind', NODE_KINDS);
  const entityType = optOneOf(body.entityType, 'entityType', ENTITY_TYPES);
  const entityId = int(body.entityId, 'entityId', { min: 1, optional: true });
  const title = reqStr(body.title, 'title', 200);
  const summary = optStr(body.summary, 'summary', 1000);
  const category = optOneOf(body.category, 'category', CATEGORY_SLUGS);
  const status = optOneOf(body.evidenceStatus, 'evidenceStatus', EVIDENCE_STATUSES);
  const tags = arr(body.tags, 'tags', 12, (t, i) => reqStr(t, `tags[${i}]`, 40));
  const x = num(body.x ?? 0, 'x', -COORD, COORD);
  const y = num(body.y ?? 0, 'y', -COORD, COORD);
  const node = await db.first<{ id: number }>(
    `INSERT INTO board_nodes (board_id, entity_type, entity_id, kind, title, summary, category_slug, evidence_status, tags_json, group_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    boardId,
    entityType,
    entityType ? entityId : null,
    kind,
    title,
    summary,
    category,
    status,
    JSON.stringify(tags),
    category ?? kind,
  );
  if (!node) throw new ApiError(500, 'error', 'Could not create card');
  await db.run('INSERT INTO board_positions (board_id, node_id, x, y) VALUES (?, ?, ?, ?)', boardId, node.id, x, y);
  await touchBoard(db, boardId);
  return { id: node.id, x, y };
}

export async function deleteNode(db: Db, boardId: number, nodeId: number) {
  const r = await db.run('DELETE FROM board_nodes WHERE id = ? AND board_id = ?', nodeId, boardId);
  if (!r.changes) throw notFound('Card');
  await touchBoard(db, boardId);
}

/** Saves many positions in one atomic batch. Unknown node ids are ignored by the WHERE clause. */
export async function savePositions(db: Db, boardId: number, body: Record<string, unknown>) {
  const positions = arr(body.positions, 'positions', 2000, (p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return { id: int(o.id, `positions[${i}].id`, { min: 1 }) as number, x: num(o.x, `positions[${i}].x`, -COORD, COORD), y: num(o.y, `positions[${i}].y`, -COORD, COORD) };
  });
  const now = new Date().toISOString();
  const stmts = positions.map((p) =>
    db.stmt(
      `INSERT INTO board_positions (board_id, node_id, x, y, updated_at)
       SELECT ?, id, ?, ?, ? FROM board_nodes WHERE id = ? AND board_id = ?
       ON CONFLICT (board_id, node_id) DO UPDATE SET x = excluded.x, y = excluded.y, updated_at = excluded.updated_at`,
      boardId,
      p.x,
      p.y,
      now,
      p.id,
      boardId,
    ),
  );
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  if (positions.length) await touchBoard(db, boardId);
  return { saved: positions.length };
}

export async function addEdge(db: Db, boardId: number, body: Record<string, unknown>, verification: RelationVerification) {
  const source = int(body.source, 'source', { min: 1 }) as number;
  const target = int(body.target, 'target', { min: 1 }) as number;
  if (source === target) throw new ApiError(400, 'invalid', 'A thread needs two different cards');
  const kind = oneOf(body.kind, 'kind', RELATION_KINDS);
  const label = optStr(body.label, 'label', 200);
  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM board_nodes WHERE board_id = ? AND id IN (?, ?)', boardId, source, target);
  if ((count?.n ?? 0) !== 2) throw new ApiError(400, 'invalid_reference', 'Both cards must be on this board');
  const edge = await db.first<{ id: number }>(
    `INSERT INTO board_edges (board_id, source_node_id, target_node_id, kind, verification, label)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    boardId,
    source,
    target,
    kind,
    verification,
    label,
  );
  await touchBoard(db, boardId);
  return { id: edge?.id, source, target, kind, verification, label };
}

export async function deleteEdge(db: Db, boardId: number, edgeId: number) {
  const r = await db.run('DELETE FROM board_edges WHERE id = ? AND board_id = ?', edgeId, boardId);
  if (!r.changes) throw notFound('Thread');
  await touchBoard(db, boardId);
}

async function touchBoard(db: Db, boardId: number) {
  await db.run("UPDATE boards SET updated_at = datetime('now') WHERE id = ?", boardId);
}
