#!/usr/bin/env node
// Static cost-safety check. Fails (exit 1) if the project could use a paid
// Cloudflare product or call an external service other than the allow-list.
// It runs in CI and in tests; it never contacts Cloudflare.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** wrangler.toml keys that would bind a service that is paid or billed by usage. */
export const FORBIDDEN_BINDINGS = [
  'r2_buckets', 'kv_namespaces', 'queues', 'durable_objects', 'ai', 'vectorize',
  'browser', 'hyperdrive', 'images', 'analytics_engine_datasets', 'mtls_certificates',
  'dispatch_namespaces', 'workflows', 'send_email', 'pipelines', 'tail_consumers',
  'unsafe', 'services', 'version_metadata', 'assets', 'secrets_store_secrets',
];
/** Keys that change billing behaviour. */
export const FORBIDDEN_SETTINGS = ['usage_model', 'limits', 'placement'];
/** The only external hosts the code may contact or load. */
export const ALLOWED_HOSTS = [
  'challenges.cloudflare.com', 'www.w3.org', 'localhost', '127.0.0.1',
  // Free public APIs (no key, no account) used by the automatic archive import.
  'query.wikidata.org', 'en.wikipedia.org', 'de.wikipedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'conspiracy-atlas.pages.dev',
];
/** Hosts of paid / usage-billed products that must never appear in code. */
export const FORBIDDEN_PATTERNS = [
  /r2\.cloudflarestorage\.com/i, /r2\.dev/i, /imagedelivery\.net/i, /videodelivery\.net/i,
  /cloudflarestream\.com/i, /\/ai\/run\//i, /gateway\.ai\.cloudflare\.com/i,
  /api\.openai\.com/i, /api\.anthropic\.com/i, /maps\.googleapis\.com/i, /api\.mapbox\.com/i,
];
const CODE_DIRS = ['src', 'server', 'functions', 'shared', 'public', 'workers', 'index.html'];
/** Every wrangler config in the repository: the Pages project and the import cron Worker. */
const WRANGLER_FILES = ['wrangler.toml', 'workers/import-cron/wrangler.toml'];
const CODE_EXT = /\.(ts|tsx|js|mjs|json|html|css|svg|toml)$|_headers$|_routes\.json$/;

function walk(p, out = []) {
  const full = path.join(ROOT, p);
  let st;
  try {
    st = statSync(full);
  } catch {
    return out;
  }
  if (st.isDirectory()) for (const e of readdirSync(full)) walk(path.join(p, e), out);
  else if (CODE_EXT.test(p)) out.push(p);
  return out;
}

export function checkWranglerToml(text) {
  const problems = [];
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
  for (const line of lines) {
    const section = line.match(/^\[\[?\s*([a-z0-9_.]+)\s*\]?\]$/i)?.[1];
    if (section) {
      const root = section.split('.')[0];
      if (FORBIDDEN_BINDINGS.includes(root)) problems.push(`wrangler.toml: forbidden binding section [${section}]`);
      if (FORBIDDEN_SETTINGS.includes(root)) problems.push(`wrangler.toml: forbidden setting section [${section}]`);
      continue;
    }
    const key = line.match(/^([a-z_]+)\s*=/i)?.[1];
    if (key && (FORBIDDEN_BINDINGS.includes(key) || FORBIDDEN_SETTINGS.includes(key))) problems.push(`wrangler.toml: forbidden key "${key}"`);
    const limit = line.match(/^IMAGE_STORAGE_LIMIT_MB\s*=\s*"?(\d+)/i)?.[1];
    if (limit && Number(limit) > 400) problems.push('wrangler.toml: IMAGE_STORAGE_LIMIT_MB must not exceed 400 (D1 free database: 500 MB)');
  }
  return problems;
}

export function checkSourceText(file, text) {
  const problems = [];
  for (const re of FORBIDDEN_PATTERNS) if (re.test(text)) problems.push(`${file}: references a paid service (${re})`);
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    if (!ALLOWED_HOSTS.includes(m[1].toLowerCase())) problems.push(`${file}: external host "${m[1]}" is not on the allow-list`);
  }
  return problems;
}

export function runCostCheck() {
  const problems = WRANGLER_FILES.flatMap((f) => checkWranglerToml(readFileSync(path.join(ROOT, f), 'utf8')).map((p) => p.replace('wrangler.toml', f)));
  for (const dir of CODE_DIRS) for (const f of walk(dir)) problems.push(...checkSourceText(f, readFileSync(path.join(ROOT, f), 'utf8')));
  return problems;
}

if (process.argv[1]?.endsWith('cost-check.mjs')) {
  const problems = runCostCheck();
  if (problems.length) {
    console.error('Cost-safety check FAILED:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('Cost-safety check passed: only Pages, Pages Functions, D1 and Turnstile are used.');
}
