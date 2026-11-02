// German homepage for crawlers. / is a static file; /de is the same app, so without this Function
// a shared German link would advertise the English title and the English preview card.
import type { Locale } from '../shared/constants';
import { homeDescription } from './preview/copy';
import { CARD_H, CARD_W } from './preview/size';
import { homeCardPath, injectOg, localeUrls, SITE_NAME, snippet, type OgData } from './og';
import type { PagesEnv } from './casePage';

export async function serveHome(request: Request, env: PagesEnv, locale: Locale): Promise<Response> {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL('/', url));
  if (!page.ok) return page;
  const alternates = localeUrls(url.origin, '/');
  const description = snippet(homeDescription(locale), 200);
  const og: OgData = {
    title: SITE_NAME,
    description,
    url: alternates.find((a) => a.locale === locale)!.url,
    image: new URL(homeCardPath(locale), url.origin).toString(),
    imageAlt: SITE_NAME,
    imageWidth: CARD_W,
    imageHeight: CARD_H,
    locale,
    alternates,
    type: 'website',
  };
  const headers = new Headers(page.headers);
  headers.delete('content-length');
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(injectOg(await page.text(), og, { jsonLd: false }), { status: 200, headers });
}
