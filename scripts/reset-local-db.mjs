#!/usr/bin/env node
// Deletes the LOCAL development database (.wrangler/state) and re-applies all migrations,
// which also loads the seed archive. Never touches the remote database.
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DB_NAME, ROOT, wrangler } from './lib.mjs';

const state = path.join(ROOT, '.wrangler', 'state', 'v3', 'd1');
if (existsSync(state)) {
  rmSync(state, { recursive: true, force: true });
  console.log('Local D1 state removed.');
}
wrangler(['d1', 'migrations', 'apply', DB_NAME, '--local']);
