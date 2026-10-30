// Pages Function for /theory/<slug>: serves the normal app page with link-preview tags for that case.
// Only case pages invoke a Function (public/_routes.json); every other page stays a plain static asset.
import { Db } from '../../server/db';
import type { Env } from '../../server/env';
import { injectOg, loadOg } from '../../server/og';

type PagesEnv = Env & { ASSETS: Fetcher };

export const onRequestGet: PagesFunction<PagesEnv, 'slug'> = async ({ request, env, params }) => {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL('/', url));
  if (!env.DB || !page.ok) return page;
  try {
    const locale = url.searchParams.get('lang') === 'de' ? 'de' : 'en';
    const og = await loadOg(Db.from(env), String(params.slug), locale, url.origin);
    if (!og) return page;
    const headers = new Headers(page.headers);
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(injectOg(await page.text(), og), { status: 200, headers });
  } catch {
    // Previews are optional: on any database problem the normal page is served.
    return page;
  }
};
