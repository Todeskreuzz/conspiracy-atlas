import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error plain ESM script without type declarations
import { runCostCheck, checkWranglerToml, checkSourceText, FORBIDDEN_PATTERNS } from '../scripts/cost-check.mjs';

describe('cost safety (free-only)', () => {
  it('the repository passes the static cost check', () => {
    expect(runCostCheck()).toEqual([]);
  });

  it('detects forbidden bindings and settings', () => {
    expect(checkWranglerToml('[[r2_buckets]]\nbinding = "FILES"')).toHaveLength(1);
    expect(checkWranglerToml('[ai]\nbinding = "AI"')).toHaveLength(1);
    expect(checkWranglerToml('[[kv_namespaces]]\nbinding = "KV"')).toHaveLength(1);
    expect(checkWranglerToml('[[durable_objects.bindings]]\nname = "X"')).toHaveLength(1);
    expect(checkWranglerToml('[[queues.producers]]\nqueue = "q"')).toHaveLength(1);
    expect(checkWranglerToml('usage_model = "unbound"')).toHaveLength(1);
    expect(checkWranglerToml('[vars]\nFEATURE_COMMUNITY_UPLOADS = "true"')).toHaveLength(1);
    expect(checkWranglerToml('[[d1_databases]]\nbinding = "DB"')).toEqual([]);
  });

  it('detects calls to paid or non-allow-listed services', () => {
    expect(checkSourceText('x.ts', 'fetch("https://api.openai.com/v1/x")').length).toBeGreaterThan(0);
    expect(checkSourceText('x.ts', 'const u = "https://abc.r2.cloudflarestorage.com"').length).toBeGreaterThan(0);
    expect(checkSourceText('x.ts', 'fetch("https://tile.example.org/{z}/{x}/{y}.png")')).toHaveLength(1);
    expect(checkSourceText('x.ts', 'fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify")')).toEqual([]);
  });

  it('wrangler.toml binds D1 only and keeps uploads off', () => {
    const toml = readFileSync('wrangler.toml', 'utf8');
    const sections = [...toml.matchAll(/^\[\[?([a-z0-9_.]+)\]?\]/gm)].map((m) => m[1]);
    expect(sections.sort()).toEqual(['d1_databases', 'vars']);
    expect(toml).toMatch(/FEATURE_COMMUNITY_UPLOADS = "false"/);
    expect(toml).not.toMatch(/^\s*(TURNSTILE_SECRET_KEY|ADMIN_PASSWORD_HASH|SESSION_SECRET|ADMIN_USERNAME)\s*=/m);
  });

  it('the server only ever contacts Turnstile', () => {
    const files = readdirSync('server', { recursive: true }).map((f) => String(f).replace(/\\/g, '/')).filter((f) => f.endsWith('.ts'));
    const fetchers = files.filter((f) => /\bfetch\w*\(/.test(readFileSync(join('server', f), 'utf8')));
    expect(fetchers.sort()).toEqual(['routes/community.ts', 'security.ts']);
  });

  it('no secrets are committed', () => {
    expect(existsSync('.dev.vars.example')).toBe(true);
    const example = readFileSync('.dev.vars.example', 'utf8');
    expect(example).toMatch(/ADMIN_PASSWORD_HASH=\s*$/m);
    expect(example).toMatch(/SESSION_SECRET=\s*$/m);
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toMatch(/\.dev\.vars/);
    expect(gitignore).toMatch(/backups/);
  });
});

describe('static Pages build', () => {
  it(
    'builds the complete site into a static directory with routing files',
    async () => {
      const { build } = await import('vite');
      const outDir = mkdtempSync(join(tmpdir(), 'ca-build-'));
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
      const files = readdirSync(outDir, { recursive: true }).map(String);
      expect(files).toContain('index.html');
      expect(files).toContain('_routes.json');
      expect(files).toContain('_headers');
      expect(JSON.parse(readFileSync(join(outDir, '_routes.json'), 'utf8')).include).toEqual(['/api/*']);
      const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(outDir, f), 'utf8')).join('\n');
      for (const re of FORBIDDEN_PATTERNS as RegExp[]) expect(re.test(js), String(re)).toBe(false);
      // No map tile servers: the map is rendered from bundled data only.
      expect(js).not.toMatch(/tile\.openstreetmap|\{z\}\/\{x\}\/\{y\}/);
      expect(readFileSync(join(outDir, '_headers'), 'utf8')).toContain('Content-Security-Policy');
    },
    60_000,
  );
});
