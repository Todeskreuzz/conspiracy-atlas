import type { Env } from './env';
import { UnavailableError, classifyDbError, ApiError } from './errors';

export type Row = Record<string, unknown>;

/** Returns the D1 binding or throws "Currently unavailable!" (service not configured). */
export function requireDb(env: Env): D1Database {
  if (!env.DB) throw new UnavailableError('database', 'not_configured');
  return env.DB;
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = String((err as Error)?.message ?? '');
    // Constraint violations are client errors, not service outages.
    if (/UNIQUE constraint failed/i.test(msg)) throw new ApiError(409, 'conflict', 'Entry already exists');
    if (/FOREIGN KEY constraint failed/i.test(msg)) throw new ApiError(400, 'invalid_reference', 'Referenced entry does not exist');
    if (/CHECK constraint failed/i.test(msg)) throw new ApiError(400, 'invalid', 'Invalid value');
    console.error('D1 error:', msg.slice(0, 200));
    throw new UnavailableError('database', classifyDbError(err));
  }
}

export class Db {
  constructor(public d1: D1Database) {}

  static from(env: Env): Db {
    return new Db(requireDb(env));
  }

  all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
    return guard(async () => (await this.d1.prepare(sql).bind(...params).all<T>()).results ?? []);
  }

  first<T = Row>(sql: string, ...params: unknown[]): Promise<T | null> {
    return guard(async () => (await this.d1.prepare(sql).bind(...params).first<T>()) ?? null);
  }

  run(sql: string, ...params: unknown[]): Promise<{ changes: number; lastRowId: number }> {
    return guard(async () => {
      const r = await this.d1.prepare(sql).bind(...params).run();
      return { changes: Number(r.meta?.changes ?? 0), lastRowId: Number(r.meta?.last_row_id ?? 0) };
    });
  }

  stmt(sql: string, ...params: unknown[]): D1PreparedStatement {
    return this.d1.prepare(sql).bind(...params);
  }

  /** Executes statements atomically (D1 batches run as a single transaction). */
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    if (statements.length === 0) return Promise.resolve([]);
    return guard(() => this.d1.batch(statements));
  }
}

export function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pageParams(query: Record<string, string | undefined>, maxSize = 50, defSize = 20) {
  const page = Math.max(1, Math.min(10000, parseInt(query.page ?? '1', 10) || 1));
  const pageSize = Math.max(1, Math.min(maxSize, parseInt(query.pageSize ?? String(defSize), 10) || defSize));
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize + 1 };
}

export function paged<T>(rows: T[], page: number, pageSize: number) {
  return { items: rows.slice(0, pageSize), page, pageSize, hasMore: rows.length > pageSize };
}
