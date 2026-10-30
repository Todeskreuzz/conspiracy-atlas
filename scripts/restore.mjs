#!/usr/bin/env node
// Restores a backup into the D1 database. ALWAYS writes a fresh backup first.
//
//   npm run restore:local  -- backups/<file>.json
//   npm run restore:remote -- backups/<file>.json --yes
//
// JSON backups (admin export or backup.mjs) are data-only: they replace the rows
// of every archive table on an already migrated database.
// SQL dumps (wrangler d1 export) contain CREATE TABLE statements and can only be
// restored into an EMPTY database (pass --empty-db to confirm).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { backupToSql } from '../shared/backup-core.mjs';
import { DB_NAME, ensureBackupDir, stamp, target, wrangler } from './lib.mjs';
import { runBackup } from './backup.mjs';

const argv = process.argv.slice(2);
const where = target(argv);
const file = argv.find((a) => !a.startsWith('--'));
if (!file || !existsSync(file)) {
  console.error('Usage: restore.mjs --local|--remote <backup.json|backup.sql> [--yes] [--empty-db]');
  process.exit(2);
}

let sqlFile;
if (file.endsWith('.json')) {
  const sql = backupToSql(JSON.parse(readFileSync(file, 'utf8')));
  sqlFile = path.join(ensureBackupDir(), `${stamp()}-restore-statements.sql`);
  writeFileSync(sqlFile, sql);
} else if (file.endsWith('.sql')) {
  if (!argv.includes('--empty-db')) {
    console.error('SQL dumps recreate the tables. Restore them only into an empty database and pass --empty-db.');
    process.exit(2);
  }
  sqlFile = file;
} else {
  console.error('Unknown backup format (expected .json or .sql).');
  process.exit(2);
}

if (where === '--remote' && !argv.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`This REPLACES the data of the REMOTE database ${DB_NAME}. Type "restore" to continue: `);
  rl.close();
  if (answer.trim() !== 'restore') {
    console.error('Aborted.');
    process.exit(1);
  }
}

console.log('Creating a safety backup before restoring…');
runBackup(where, '-pre-restore');
wrangler(['d1', 'execute', DB_NAME, where, '--file', sqlFile, '--yes']);
console.log('Restore finished.');
