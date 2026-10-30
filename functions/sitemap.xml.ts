// Pages Function for /sitemap.xml: built from D1 so new and imported cases are found by search engines.
import { Db } from '../server/db';
import type { Env } from '../server/env';
import { buildSitemap } from '../server/seo';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return new Response('Currently unavailable!', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  try {
    const xml = await buildSitemap(Db.from(env), new URL(request.url).origin);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return new Response('Currently unavailable!', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' } });
  }
};
