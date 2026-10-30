// Sitemap for search engines: every public page and every published case, each with its English and German URL.
import type { Db } from './db';
import { localeUrls } from './og';

/** Overview pages worth indexing (no admin, saved items or forms). */
export const SITEMAP_PAGES = ['/', '/archive', '/wall', '/timeline', '/map', '/organizations', '/events', '/investigations', '/community', '/knowledge', '/experts', '/about'];

/** The sitemap protocol allows 50,000 URLs per file. */
const MAX_URLS = 50000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

interface Entry {
  path: string;
  lastmod?: string;
}

function urlXml(origin: string, e: Entry): string {
  const links = localeUrls(origin, e.path);
  const lastmod = e.lastmod ? `<lastmod>${esc(e.lastmod.slice(0, 10))}</lastmod>` : '';
  const alt = links.map((l) => `<xhtml:link rel="alternate" hreflang="${l.locale}" href="${esc(l.url)}"/>`).join('');
  return `<url><loc>${esc(links[0]!.url)}</loc>${lastmod}${alt}</url>`;
}

export async function buildSitemap(db: Db, origin: string): Promise<string> {
  const [theories, orgs, people, events] = await Promise.all([
    db.all<{ slug: string; updated_at: string }>('SELECT slug, updated_at FROM theories WHERE is_published = 1 ORDER BY updated_at DESC'),
    db.all<{ slug: string }>('SELECT slug FROM organizations ORDER BY slug'),
    db.all<{ slug: string }>('SELECT slug FROM people ORDER BY slug'),
    db.all<{ slug: string }>('SELECT slug FROM events ORDER BY slug'),
  ]);
  const entries: Entry[] = [
    ...SITEMAP_PAGES.map((path) => ({ path })),
    ...theories.map((r) => ({ path: `/theory/${encodeURIComponent(r.slug)}`, lastmod: r.updated_at })),
    ...orgs.map((r) => ({ path: `/organizations/${encodeURIComponent(r.slug)}` })),
    ...people.map((r) => ({ path: `/people/${encodeURIComponent(r.slug)}` })),
    ...events.map((r) => ({ path: `/events/${encodeURIComponent(r.slug)}` })),
  ].slice(0, MAX_URLS);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map((e) => urlXml(origin, e)),
    '</urlset>',
  ].join('\n');
}
