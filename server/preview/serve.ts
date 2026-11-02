// HTTP entry for /og/*.png. The image is drawn here; Pages does not apply public/_headers to a
// Function response, so the anti-framing headers are set on the response itself.
import type { Env } from '../env';
import { Db } from '../db';
import type { Locale } from '../../shared/constants';
import { loadCasePreview } from '../og';
import { renderCaseCard, renderHomeCard } from './card';

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; sandbox; frame-ancestors 'none'",
};

export interface OgContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
  waitUntil?: (promise: Promise<unknown>) => void;
}

function partsOf(path: string | string[] | undefined): string[] {
  if (Array.isArray(path)) return path;
  return path ? path.split('/').filter(Boolean) : [];
}

function route(parts: string[]): { kind: 'home' | 'case'; locale: Locale; slug?: string } | null {
  let locale: Locale = 'en';
  let rest = parts;
  if (rest[0] === 'de') {
    locale = 'de';
    rest = rest.slice(1);
  }
  if (rest.length === 1 && rest[0] === 'home.png') return { kind: 'home', locale };
  if (rest.length === 2 && rest[0] === 'theory') {
    const slug = rest[1]?.replace(/\.png$/, '');
    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && rest[1]?.endsWith('.png')) return { kind: 'case', locale, slug };
  }
  return null;
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY } });
}

async function draw(ctx: OgContext, spec: ReturnType<typeof route>): Promise<Response> {
  if (!spec) return text(404, 'Not found');
  const host = new URL(ctx.request.url).host;
  if (spec.kind === 'home') return png(renderHomeCard(spec.locale));
  if (!ctx.env.DB) return text(503, 'Currently unavailable!');
  try {
    const row = await loadCasePreview(Db.from(ctx.env), spec.slug!, spec.locale);
    if (!row) return text(404, 'Not found');
    return png(renderCaseCard({ ...row, locale: spec.locale, host, summary: row.summary }));
  } catch {
    return text(503, 'Currently unavailable!');
  }
}

function png(bytes: Uint8Array): Response {
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'public, max-age=86400',
      ...SECURITY,
    },
  });
}

export async function serveOg(ctx: OgContext): Promise<Response> {
  const spec = route(partsOf(ctx.params.path));
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (cache && ctx.request.method === 'GET') {
    try {
      const hit = await cache.match(ctx.request);
      if (hit) return hit;
    } catch {
      // The cache is an optimisation; a miss or a runtime without it still draws the card.
    }
  }
  const response = await draw(ctx, spec);
  if (cache && response.ok && ctx.waitUntil) {
    const copy = response.clone();
    ctx.waitUntil(cache.put(ctx.request, copy).catch(() => undefined));
  }
  return response;
}
