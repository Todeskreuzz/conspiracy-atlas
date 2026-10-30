#!/usr/bin/env node
// Writes a full backup of the D1 database into ./backups (git-ignored):
//   <stamp>-<target>.sql   complete SQL dump (wrangler d1 export)
//   <stamp>-<target>.json  data-only JSON backup (same format as the admin export)
// Usage: npm run backup:local | npm run backup:remote
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BACKUP_TABLES } from '../shared/backup-core.mjs';
import { DB_NAME, ensureBackupDir, stamp, target, wrangler } from './lib.mjs';

export function runBackup(where, label = '') {
  const dir = ensureBackupDir();
  const base = path.join(dir, `${stamp()}-${where.slice(2)}${label}`);
  wrangler(['d1', 'export', DB_NAME, where, '--output', `${base}.sql`]);

  const tables = {};
  for (const table of BACKUP_TABLES) {
    const out = wrangler(['d1', 'execute', DB_NAME, where, '--json', '--command', `SELECT * FROM ${table}`], { capture: true });
    const parsed = JSON.parse(out);
    tables[table] = parsed[0]?.results ?? [];
  }
  writeFileSync(`${base}.json`, JSON.stringify({ format: 'conspiracy-atlas-backup', version: 1, createdAt: new Date().toISOString(), tables }, null, 2));
  console.log(`Backup written:\n  ${base}.sql\n  ${base}.json`);
  return base;
}

if (process.argv[1]?.endsWith('backup.mjs')) {
  runBackup(target(process.argv));
}
