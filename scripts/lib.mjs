// Shared helpers for the maintenance scripts. They only call the local wrangler CLI.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BACKUP_DIR = path.join(ROOT, 'backups');
export const DB_NAME = 'conspiracy-atlas-db';

export function target(argv) {
  if (argv.includes('--remote')) return '--remote';
  if (argv.includes('--local')) return '--local';
  console.error('Specify --local or --remote.');
  process.exit(2);
}

// Run the project's wrangler with node directly: no npx and no shell, so arguments such as
// `--command "SELECT * FROM x"` reach wrangler unsplit on Windows too.
const WRANGLER_BIN = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

export function wrangler(args, { capture = false } = {}) {
  const res = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: ROOT,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error(`wrangler ${args.join(' ')} failed (exit ${res.status}).`);
    process.exit(res.status ?? 1);
  }
  return res.stdout;
}

export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function ensureBackupDir() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}
