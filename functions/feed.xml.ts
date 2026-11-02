// Pages Function for /feed.xml: RSS feed with the case of the day and the newest cases, built from D1.
import { Db } from '../server/db';
import type { Env } from '../server/env';
import { LOCALES, type Locale } from '../shared/constants';
import { buildFeed } from '../server/feed';

const unavailable = () =>
  new Response('Currently unavailable!', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' } });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return unavailable();
  try {
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang');
    const locale: Locale = lang && (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : 'en';
    const xml = await buildFeed(Db.from(env), url.origin, locale);
    return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' } });
  } catch {
    return unavailable();
  }
};
