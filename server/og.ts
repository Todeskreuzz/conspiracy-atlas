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
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function clip(text: string, max = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
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
    `<link rel="canonical" href="${esc(d.url)}" />`,
  ].join('\n    ');
}

/** Replaces the default title/description of index.html with the case's preview tags. */
export function injectOg(html: string, d: OgData): string {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(`${d.title} – ${SITE_NAME}`)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `    ${ogTags(d)}\n  </head>`);
}

/** Loads the preview data of a published case, or null. */
export async function loadOg(db: Db, slug: string, locale: Locale, origin: string): Promise<OgData | null> {
  const row = await db.first<{ id: number; title: string; subtitle: string | null; summary: string; image_path: string | null }>(
    'SELECT id, title, subtitle, summary, image_path FROM theories WHERE slug = ? AND is_published = 1',
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
  const img = row.image_path && /\.(jpe?g|png|webp)$/i.test(row.image_path) ? row.image_path : DEFAULT_OG_IMAGE;
  return {
    title,
    description: clip(summary),
    url: `${origin}/theory/${encodeURIComponent(slug)}${locale === 'en' ? '' : `?lang=${locale}`}`,
    image: new URL(img, origin).toString(),
    locale,
  };
}
