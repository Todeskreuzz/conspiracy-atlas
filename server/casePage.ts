// Shared handler of the case-page Functions (/theory/<slug> and /de/theory/<slug>): serves the normal app
// page with link-preview and search-engine tags for that case in the page's language.
import { Db } from './db';
import type { Env } from './env';
import { injectOg, loadOg } from './og';
import { localePath } from '../shared/localePath';
import type { Locale } from '../shared/constants';

export type PagesEnv = Env & { ASSETS: Fetcher };

export async function serveCasePage(request: Request, env: PagesEnv, slug: string, locale: Locale): Promise<Response> {
  const url = new URL(request.url);
  // Old German links used ?lang=de; they move permanently to the German URL.
  const lang = url.searchParams.get('lang');
  if (lang === 'de' || (lang === 'en' && locale !== 'en')) {
    url.searchParams.delete('lang');
    const target = localePath(lang, `/theory/${encodeURIComponent(slug)}`) + url.search + url.hash;
    return Response.redirect(new URL(target, url.origin).toString(), 301);
  }
  const page = await env.ASSETS.fetch(new URL('/', url));
  if (!env.DB || !page.ok) return page;
  try {
    const og = await loadOg(Db.from(env), slug, locale, url.origin);
    if (!og) return page;
    const headers = new Headers(page.headers);
    headers.delete('content-length');
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(injectOg(await page.text(), og), { status: 200, headers });
  } catch {
    // Previews are optional: on any database problem the normal page is served.
    return page;
  }
}
