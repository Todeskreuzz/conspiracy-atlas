// A small D1-compatible adapter over Node's built-in SQLite, used for integration tests.
// It mirrors the subset of the D1 API the application uses (prepare/bind/first/all/run/batch/exec).
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Loaded via require so that jsdom-based frontend tests can use the same in-memory database.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

type Params = unknown[];

class Stmt {
  constructor(private db: FakeD1, public sql: string, public params: Params = []) {}
  bind(...params: Params) {
    // Mirror Cloudflare D1: at most 100 bound parameters per statement.
    this.db.maxParams = Math.max(this.db.maxParams, params.length);
    if (params.length > 100) throw new Error('D1_ERROR: too many SQL variables');
    return new Stmt(this.db, this.sql, params);
  }
  private conv() {
    return this.params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p)) as never[];
  }
  async first<T>(col?: string): Promise<T | null> {
    this.db.check(this.sql);
    const row = this.db.raw.prepare(this.sql).get(...this.conv()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (col ? row[col] : { ...row }) as T;
  }
  async all<T>() {
    this.db.check(this.sql);
    const rows = this.db.raw.prepare(this.sql).all(...this.conv()) as T[];
    return { results: rows.map((r) => ({ ...(r as object) })) as T[], success: true, meta: {} };
  }
  async run() {
    this.db.check(this.sql);
    const r = this.db.raw.prepare(this.sql).run(...this.conv());
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  runSync() {
    return this.db.raw.prepare(this.sql).run(...this.conv());
  }
}

export class FakeD1 {
  raw: DatabaseSync;
  /** Optional failure injection: throw this error on the next statement(s). */
  failWith: Error | null = null;
  queries: string[] = [];
  /** Largest number of bound parameters seen in one statement. */
  maxParams = 0;
  constructor() {
    this.raw = new DatabaseSync(':memory:');
    this.raw.exec('PRAGMA foreign_keys = ON');
  }
  check(sql: string) {
    this.queries.push(sql);
    if (this.failWith) throw this.failWith;
  }
  prepare(sql: string) {
    return new Stmt(this, sql);
  }
  async batch(stmts: Stmt[]) {
    if (this.failWith) throw this.failWith;
    this.raw.exec('BEGIN');
    try {
      const out = [];
      for (const s of stmts) {
        const r = s.runSync();
        out.push({ success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } });
      }
      this.raw.exec('COMMIT');
      return out;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql: string) {
    this.raw.exec(sql);
    return { count: 1, duration: 0 };
  }
}

export const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations', 'd1');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

export function createDb({ seed = true }: { seed?: boolean } = {}): FakeD1 {
  const db = new FakeD1();
  for (const f of migrationFiles()) {
    if (!seed && f.includes('seed')) continue;
    db.raw.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
  }
  return db;
}
