import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BACKUP_TABLES, backupToSql, toCsv, validateBackup } from '../shared/backup-core.mjs';
import { client, makeEnv } from './helpers/app';
import { createDb, migrationFiles } from './helpers/d1';

const REQUIRED_TABLES = [
  'theories', 'categories', 'claims', 'evidence', 'sources', 'counter_arguments', 'organizations', 'people', 'locations',
  'events', 'relationships', 'documents', 'boards', 'board_nodes', 'board_positions', 'investigations', 'investigation_notes',
  'community_submissions', 'moderation_actions', 'authors', 'reports', 'tags', 'translations', 'settings', 'case_notes',
];

describe('migrations', () => {
  it('are numbered and create every required table', () => {
    expect(migrationFiles()).toEqual(['0001_schema.sql', '0002_seed.sql', '0003_images.sql', '0004_case_images.sql', '0005_more_cases.sql', '0006_case_notes.sql']);
    const db = createDb({ seed: false });
    const tables = db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r: any) => r.name);
    for (const t of REQUIRED_TABLES) expect(tables, t).toContain(t);
  });

  it('enforce foreign keys and check constraints', () => {
    const db = createDb();
    expect(() => db.raw.exec("INSERT INTO claims (theory_id, text, evidence_status) VALUES (9999, 'x', 'unverified')")).toThrow(/FOREIGN KEY/);
    expect(() => db.raw.exec("UPDATE theories SET evidence_status = 'proven' WHERE id = 1")).toThrow(/CHECK/);
  });

  it('seed contains the case files with sources and both languages', () => {
    const db = createDb();
    const slugs = db.raw.prepare('SELECT slug FROM theories ORDER BY slug').all().map((r: any) => r.slug);
    expect(slugs).toEqual([
      'area-51', 'chemtrail-claims', 'cointelpro', 'gulf-of-tonkin-incident', 'illuminati-narratives',
      'jfk-related-conspiracy-narratives', 'mkultra', 'moon-landing-conspiracy-theory', 'operation-northwoods',
      'operation-paperclip', 'reichstag-fire', 'roswell-incident', 'tuskegee-syphilis-study', 'watergate',
    ]);
    const unsourced = db.raw.prepare('SELECT t.slug FROM theories t WHERE NOT EXISTS (SELECT 1 FROM evidence e WHERE e.theory_id = t.id)').all();
    expect(unsourced).toEqual([]);
    const de = db.raw.prepare("SELECT COUNT(*) AS n FROM translations WHERE locale = 'de' AND entity_type = 'theory' AND field = 'title'").get() as any;
    expect(de.n).toBe(14);
    // Every claim carries its own evidence status.
    expect((db.raw.prepare('SELECT COUNT(*) AS n FROM claims WHERE evidence_status IS NULL').get() as any).n).toBe(0);
  });

  it('wrangler.toml points at the migrations directory', () => {
    const toml = readFileSync('wrangler.toml', 'utf8');
    expect(toml).toMatch(/migrations_dir = "migrations\/d1"/);
    expect(toml).toMatch(/database_name = "conspiracy-atlas-db"/);
    expect(toml).toMatch(/^name = "conspiracy-atlas"/m);
  });
});

describe('backup and restore', () => {
  it('round-trips an admin JSON export through backupToSql', async () => {
    const env = await makeEnv();
    const admin = client(env);
    await admin.login();
    const exported = (await admin.get('/api/admin/export')).json;

    const target = createDb({ seed: false });
    target.raw.exec("INSERT INTO categories (slug, name, sort_order) VALUES ('history', 'Old row to be replaced', 1)");
    target.raw.exec(backupToSql(exported));
    for (const table of BACKUP_TABLES) {
      const n = (target.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as any).n;
      expect(n, table).toBe(exported.tables[table].length);
    }
    expect((target.raw.prepare("SELECT name FROM categories WHERE slug = 'history'").get() as any).name).not.toBe('Old row to be replaced');
    expect(target.raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('rejects foreign or malicious backup files', () => {
    expect(() => validateBackup({ format: 'other', version: 1, tables: {} })).toThrow();
    expect(() => validateBackup({ format: 'conspiracy-atlas-backup', version: 1, tables: { admin_sessions: [] } })).toThrow(/Unknown table/);
    expect(() => validateBackup({ format: 'conspiracy-atlas-backup', version: 1, tables: { tags: [{ 'name; DROP TABLE x': 1 }] } })).toThrow(/Invalid column/);
    const sql = backupToSql({ format: 'conspiracy-atlas-backup', version: 1, tables: { tags: [{ id: 1, slug: "it's", name: "O'Brien" }] } });
    expect(sql).toContain("'O''Brien'");
  });

  it('CSV export neutralises spreadsheet formulas', () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'plain, "quoted"' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"plain, ""quoted"""');
  });
});
