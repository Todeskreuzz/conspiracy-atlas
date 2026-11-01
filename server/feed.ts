// RSS 2.0 feed: today's case of the day plus the newest published cases, in English or German (/feed.xml?lang=de).
// Feed readers poll it, so people come back without a newsletter service or any stored e-mail addresses.
import type { Db } from './db';
import type { Locale } from '../shared/constants';
import { THEORY_FIELDS, THEORY_SUMMARY_SELECT, mapTheorySummary, translate } from './repo';
import { caseOfTheDayIndex } from './routes/public';
import { SITE_NAME, clip } from './og';
import { localePath } from '../shared/localePath';

/** How many new cases the feed lists besides the case of the day. */
export const FEED_SIZE = 20;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) to the RFC 822 date RSS requires. */
export function rfc822(sqlTime: string): string {
  const d = new Date(`${sqlTime.replace(' ', 'T').slice(0, 19)}Z`);
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toUTCString();
}

const TEXT = {
  en: { description: 'New cases and the case of the day from the interactive archive of theories, mysteries and documented operations.', cotd: 'Case of the day' },
  de: { description: 'Neue Akten und der Fall des Tages aus dem interaktiven Archiv für Theorien, Geheimnisse und dokumentierte Operationen.', cotd: 'Fall des Tages' },
} as const;

interface Item {
  title: string;
  link: string;
  guid: string;
  date: string;
  description: string;
  category: string;
}

function itemXml(i: Item): string {
  return [
    '<item>',
    `<title>${esc(i.title)}</title>`,
    `<link>${esc(i.link)}</link>`,
    `<guid isPermaLink="false">${esc(i.guid)}</guid>`,
    `<pubDate>${i.date}</pubDate>`,
    `<category>${esc(i.category)}</category>`,
    `<description>${esc(i.description)}</description>`,
    '</item>',
  ].join('');
}

export async function buildFeed(db: Db, origin: string, locale: Locale, now = new Date()): Promise<string> {
  // The feed itself is /feed.xml(?lang=de); the pages it links to use the language URLs (/de/...).
  const q = locale === 'en' ? '' : `?lang=${locale}`;
  const caseUrl = (slug: string) => `${origin}${localePath(locale, `/theory/${encodeURIComponent(slug)}`)}`;
  const day = now.toISOString().slice(0, 10);

  const count = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM theories WHERE is_published = 1');
  const n = Number(count?.n ?? 0);
  const [daily, latest] = await Promise.all([
    n ? db.first(`${THEORY_SUMMARY_SELECT} WHERE t.is_published = 1 ORDER BY t.id LIMIT 1 OFFSET ?`, caseOfTheDayIndex(day, n)) : null,
    db.all(
      `SELECT x.*, t2.created_at FROM (${THEORY_SUMMARY_SELECT} WHERE t.is_published = 1) x JOIN theories t2 ON t2.id = x.id
       ORDER BY t2.created_at DESC, x.id DESC LIMIT ?`,
      FEED_SIZE,
    ),
  ]);
  const created = new Map(latest.map((r) => [Number(r.id), String(r.created_at)]));
  const rows = await translate(db, locale, 'theory', [...(daily ? [daily] : []), ...latest].map(mapTheorySummary), THEORY_FIELDS);
  const text = TEXT[locale];

  const items: Item[] = rows.map((th, i) => {
    const isDaily = !!daily && i === 0;
    return {
      title: isDaily ? `${text.cotd}: ${th.title}` : th.title,
      link: caseUrl(th.slug),
      guid: isDaily ? `${origin}/case-of-the-day/${day}` : `${origin}/theory/${th.slug}`,
      date: isDaily ? new Date(`${day}T00:00:00Z`).toUTCString() : rfc822(created.get(th.id) ?? th.updatedAt),
      description: clip(th.summary, 500),
      category: th.category,
    };
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${esc(SITE_NAME)}</title>`,
    `<link>${esc(`${origin}${localePath(locale, '/')}`)}</link>`,
    `<atom:link href="${esc(`${origin}/feed.xml${q}`)}" rel="self" type="application/rss+xml"/>`,
    `<description>${esc(text.description)}</description>`,
    `<language>${locale}</language>`,
    `<lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    '<ttl>60</ttl>',
    ...items.map(itemXml),
    '</channel>',
    '</rss>',
  ].join('\n');
}
