// Link previews (Open Graph / Twitter cards) for case pages. Crawlers of WhatsApp, Reddit, X etc. do not run
// JavaScript, so the Pages Function for /theory/* puts the case's title, summary and photo into the static index.html.
import type { Db } from './db';
import { EVIDENCE_STATUSES, LOCALES, type EvidenceStatus, type Locale } from '../shared/constants';
import { localeAlternates } from '../shared/localePath';
import { statusLabel } from './preview/copy';
import { CARD_H, CARD_W } from './preview/size';

export const SITE_NAME = 'The Conspiracy Atlas';

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
  type?: 'article' | 'website';
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function clip(text: string, max = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
}

/**
 * Search snippet: the longest run of whole sentences that fits, so a result never ends mid-sentence.
 * A sentence end must follow a lowercase letter, digit or closing quote, so "U.S." does not count.
 * If not even one sentence fits, the text is cut at a word boundary with an ellipsis.
 */
export function snippet(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const ends = [...t.slice(0, max + 1).matchAll(/[a-z0-9)"”][.!?](?=\s|$)/g)];
  const last = ends.at(-1);
  if (last && last.index !== undefined && last.index + 2 >= 60) return t.slice(0, last.index + 2);
  return clip(t, max);
}

/** Same page in every language: English is the plain URL, other languages are prefixed (/de/...). */
export const localeUrls = localeAlternates;

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

export function ogTags(d: OgData, opts?: { jsonLd?: boolean }): string {
  const meta = (attr: 'property' | 'name', key: string, value: string) => `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return [
    meta('name', 'description', d.description),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', d.type ?? 'article'),
    meta('property', 'og:title', d.title),
    meta('property', 'og:description', d.description),
    meta('property', 'og:url', d.url),
    meta('property', 'og:image', d.image),
    ...(d.imageWidth ? [meta('property', 'og:image:width', String(d.imageWidth)), meta('property', 'og:image:height', String(d.imageHeight ?? d.imageWidth))] : []),
    ...(d.imageAlt ? [meta('property', 'og:image:alt', d.imageAlt)] : []),
    meta('property', 'og:locale', OG_LOCALE[d.locale]),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', d.title),
    meta('name', 'twitter:description', d.description),
    meta('name', 'twitter:image', d.image),
    ...LOCALES.filter((l) => l !== d.locale).map((l) => meta('property', 'og:locale:alternate', OG_LOCALE[l])),
    `<link rel="canonical" href="${esc(d.url)}" />`,
    ...(d.alternates ?? []).map((a) => `<link rel="alternate" hreflang="${a.locale}" href="${esc(a.url)}" />`),
    ...(opts?.jsonLd === false ? [] : [jsonLd(d)]),
  ].join('\n    ');
}

/** Replaces the default title/description of index.html with the page's preview tags. */
export function injectOg(html: string, d: OgData, opts?: { jsonLd?: boolean }): string {
  const title = d.type === 'website' && d.title === SITE_NAME ? SITE_NAME : `${d.title} – ${SITE_NAME}`;
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${d.locale}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `    ${ogTags(d, opts)}\n  </head>`);
}

/** Stable cache-buster so a changed title, summary or rating gets a new image URL. */
export function cardVersion(title: string, status: string, summary: string): string {
  let hash = 5381;
  const text = `${title}\0${status}\0${summary}`;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash, 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

const OG_LOCALE: Record<Locale, string> = { en: 'en_GB', de: 'de_DE', fr: 'fr_FR', es: 'es_ES' };

export function homeCardPath(locale: Locale): string {
  return locale === 'en' ? '/og/home.png' : `/og/${locale}/home.png`;
}

export function caseCardPath(locale: Locale, slug: string, version: string): string {
  const base = locale === 'en' ? `/og/theory/${encodeURIComponent(slug)}.png` : `/og/${locale}/theory/${encodeURIComponent(slug)}.png`;
  return `${base}?v=${version}`;
}

export interface CasePreview {
  title: string;
  summary: string;
  status: EvidenceStatus;
}

function asStatus(value: string): EvidenceStatus {
  return (EVIDENCE_STATUSES as readonly string[]).includes(value) ? (value as EvidenceStatus) : 'unverified';
}

/** Published case fields the preview tags and the card image both need. */
async function loadCase(db: Db, slug: string, locale: Locale): Promise<(CasePreview & { id: number; created_at: string; updated_at: string }) | null> {
  const row = await db.first<{ id: number; title: string; summary: string; evidence_status: string; created_at: string; updated_at: string }>(
    'SELECT id, title, summary, evidence_status, created_at, updated_at FROM theories WHERE slug = ? AND is_published = 1',
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
  return { id: row.id, title, summary, status: asStatus(row.evidence_status), created_at: row.created_at, updated_at: row.updated_at };
}

export async function loadCasePreview(db: Db, slug: string, locale: Locale): Promise<CasePreview | null> {
  const row = await loadCase(db, slug, locale);
  return row ? { title: row.title, summary: row.summary, status: row.status } : null;
}

/** Loads the preview data of a published case, or null. The image is the generated card. */
export async function loadOg(db: Db, slug: string, locale: Locale, origin: string): Promise<OgData | null> {
  const row = await loadCase(db, slug, locale);
  if (!row) return null;
  const description = snippet(row.summary);
  const alternates = localeUrls(origin, `/theory/${encodeURIComponent(slug)}`);
  const label = statusLabel(locale, row.status);
  return {
    title: row.title,
    description,
    url: alternates.find((a) => a.locale === locale)!.url,
    image: new URL(caseCardPath(locale, slug, cardVersion(row.title, row.status, row.summary)), origin).toString(),
    imageAlt: `${row.title} — ${label}`,
    imageWidth: CARD_W,
    imageHeight: CARD_H,
    locale,
    alternates,
    published: row.created_at,
    modified: row.updated_at,
  };
}
