import { describe, it, expect } from 'vitest';
import { makeEnv } from './helpers/app';
import { Db } from '../server/db';
import { buildFeed, rfc822, FEED_SIZE } from '../server/feed';
import { onRequestGet as feed } from '../functions/feed.xml';

const call = (url: string, env: unknown) => (feed as any)({ request: new Request(url), env }) as Promise<Response>;

describe('RSS feed', () => {
  it('serves valid RSS with the case of the day first and the newest cases after it', async () => {
    const env = await makeEnv();
    const res = await call('https://conspiracy-atlas.pages.dev/feed.xml', env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/rss+xml');
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0"/);
    expect(xml).toContain('<atom:link href="https://conspiracy-atlas.pages.dev/feed.xml" rel="self"');
    const items = xml.match(/<item>.*?<\/item>/g)!;
    expect(items.length).toBeGreaterThan(2);
    expect(items.length).toBeLessThanOrEqual(FEED_SIZE + 1);
    expect(items[0]).toMatch(/<title>Case of the day: /);
    expect(items[0]).toMatch(/<guid isPermaLink="false">https:\/\/conspiracy-atlas.pages.dev\/case-of-the-day\/\d{4}-\d{2}-\d{2}<\/guid>/);
    expect(items[1]).toMatch(/<link>https:\/\/conspiracy-atlas.pages.dev\/theory\/[^<?]+<\/link>/);
    expect(xml).not.toMatch(/<description>[^<]*<[a-z]/);
  });

  it('keeps the same case of the day for a whole UTC day and translates for ?lang=de', async () => {
    const env = await makeEnv();
    const db = Db.from(env);
    const pick = (x: string) => x.match(/<item><title>(.*?)<\/title>/)![1];
    const a = await buildFeed(db, 'https://x.test', 'en', new Date('2026-11-01T00:05:00Z'));
    const b = await buildFeed(db, 'https://x.test', 'en', new Date('2026-11-01T23:55:00Z'));
    expect(pick(a)).toBe(pick(b));
    const de = await buildFeed(db, 'https://x.test', 'de', new Date('2026-11-01T12:00:00Z'));
    expect(de).toContain('<language>de</language>');
    expect(pick(de)).toMatch(/^Fall des Tages: /);
    expect(de).toMatch(/<link>https:\/\/x.test\/de\/theory\/[^<?]+<\/link>/);
    expect(de).toContain('<link>https://x.test/de</link>');
    expect(de).toContain('<atom:link href="https://x.test/feed.xml?lang=de"');
  });

  it('formats SQLite times as RFC 822 dates and says unavailable without a database', async () => {
    expect(rfc822('2026-01-02 03:04:05')).toBe('Fri, 02 Jan 2026 03:04:05 GMT');
    const env = await makeEnv();
    const off = await call('https://x.test/feed.xml', { ...env, DB: undefined });
    expect(off.status).toBe(503);
    expect(await off.text()).toBe('Currently unavailable!');
  });
});
