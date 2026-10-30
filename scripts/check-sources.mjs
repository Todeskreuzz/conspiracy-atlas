#!/usr/bin/env node
// Checks that every source URL of the seed archive is reachable (HTTP status < 400).
// It only reads public web pages; it does not change any data. Run it on a machine
// with normal internet access, then review failing URLs by hand.
// Usage: npm run check-sources [-- --json report.json]
import { writeFileSync } from 'node:fs';
import { sources } from '../data/seed.mjs';

const TIMEOUT = Number(process.env.CHECK_SOURCES_TIMEOUT_MS || 15000);

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': 'ConspiracyAtlas-SourceCheck/1.0' } });
      if (res.status < 400 || method === 'GET') return { status: res.status, ok: res.status < 400, finalUrl: res.url };
    } catch (err) {
      if (method === 'GET') return { status: null, ok: false, error: String(err?.cause?.code || err?.name || err) };
    }
  }
  return { status: null, ok: false };
}

const withUrl = sources.filter((s) => s.url);
const results = [];
for (const s of withUrl) {
  const r = await probe(s.url);
  results.push({ key: s.key, url: s.url, ...r });
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.status ?? '---'} ${s.url}${r.error ? ` (${r.error})` : ''}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} reachable; ${sources.length - withUrl.length} sources without URL (books etc.).`);
const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx > 0 && process.argv[jsonIdx + 1]) {
  writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
}
process.exit(failed.length ? 1 : 0);
