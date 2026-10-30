// Link previews (Open Graph / Twitter cards) for case pages. Crawlers of WhatsApp, Reddit, X etc. do not run
// JavaScript, so the Pages Function for /theory/* puts the case's title, summary and photo into the static index.html.
import type { Db } from './db';
import type { Locale } from '../shared/constants';

export const SITE_NAME = 'The Conspiracy Atlas';
/** Fallback preview image (PNG: most platforms ignore SVG previews). */
export const DEFAULT_OG_IMAGE = '/media/og-default.png';

export interface OgData {
  title: string;
  description: string;
  url: string;
  image: string;
  locale: Locale;
  /** Language versions of the same page for hreflang (search engines). */
  alternates?: { locale: Locale | 'x-default'; url: string }[];
  /** ISO dates for the structured data. */
  published?: string;
  modified?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function clip(text: string, max = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
}

/** Same page in every language: English is the plain URL, other languages add ?lang=. */
export function localeUrls(origin: string, path: string): { locale: Locale | 'x-default'; url: string }[] {
  const base = `${origin}${path}`;
  return [
    { locale: 'en', url: base },
    { locale: 'de', url: `${base}?lang=de` },
    { locale: 'x-default', url: base },
  ];
}

const isoDate = (sqlTime: string | undefined) => (sqlTime ? `${sqlTime.replace(' ', 'T').slice(0, 19)}Z` : undefined);

/** schema.org Article for search engines; `<` is escaped so the JSON cannot close the script element. */
export function jsonLd(d: OgData): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: d.title,
    description: d.description,
    image: [d.image],
    url: d.url,
    mainEntityOfPage: d.url,
    inLanguage: d.locale,
    datePublished: isoDate(d.published),
    dateModified: isoDate(d.modified ?? d.published),
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export function ogTags(d: OgData): string {
  const meta = (attr: 'property' | 'name', key: string, value: string) => `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return [
    meta('name', 'description', d.description),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', 'article'),
    meta('property', 'og:title', d.title),
    meta('property', 'og:description', d.description),
    meta('property', 'og:url', d.url),
    meta('property', 'og:image', d.image),
    meta('property', 'og:locale', d.locale === 'de' ? 'de_DE' : 'en_GB'),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', d.title),
    meta('name', 'twitter:description', d.description),
    meta('name', 'twitter:image', d.image),
    meta('property', 'og:locale:alternate', d.locale === 'de' ? 'en_GB' : 'de_DE'),
    `<link rel="canonical" href="${esc(d.url)}" />`,
    ...(d.alternates ?? []).map((a) => `<link rel="alternate" hreflang="${a.locale}" href="${esc(a.url)}" />`),
    jsonLd(d),
  ].join('\n    ');
}

/** Replaces the default title/description of index.html with the case's preview tags. */
export function injectOg(html: string, d: OgData): string {
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${d.locale}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(`${d.title} – ${SITE_NAME}`)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `    ${ogTags(d)}\n  </head>`);
}

/** Loads the preview data of a published case, or null. */
export async function loadOg(db: Db, slug: string, locale: Locale, origin: string): Promise<OgData | null> {
  const row = await db.first<{ id: number; title: string; subtitle: string | null; summary: string; image_path: string | null; created_at: string; updated_at: string }>(
    'SELECT id, title, subtitle, summary, image_path, created_at, updated_at FROM theories WHERE slug = ? AND is_published = 1',
    slug,
  );
  if (!row) return null;
  let { title, summary } = row;
  if (locale !== 'en') {
    const tr = await db.all("SELECT field, value FROM translations WHERE entity_type = 'theory' AND entity_id = ? AND locale = ? AND field IN ('title', 'summary')", row.id, locale);
    for (const r of tr) {
      if (r.field === 'title') title = String(r.value);
      if (r.field === 'summary') summary = String(r.value);
    }
  }
  // Photos only (static files or covers stored in D1); SVG symbols fall back to the default preview.
  const img = row.image_path && (/\.(jpe?g|png|webp)$/i.test(row.image_path) || row.image_path.startsWith('/api/images/')) ? row.image_path : DEFAULT_OG_IMAGE;
  const alternates = localeUrls(origin, `/theory/${encodeURIComponent(slug)}`);
  return {
    title,
    description: clip(summary),
    url: alternates.find((a) => a.locale === locale)!.url,
    image: new URL(img, origin).toString(),
    locale,
    alternates,
    published: row.created_at,
    modified: row.updated_at,
  };
}
