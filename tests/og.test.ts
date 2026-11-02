import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeEnv } from './helpers/app';
import { Db } from '../server/db';
import { clip, injectOg, jsonLd, loadOg, snippet } from '../server/og';
import { onRequestGet as sitemap } from '../functions/sitemap.xml';
import { onRequestGet as verification } from '../functions/googlee808fb02e2c3ca02.html';
import { onRequestGet } from '../functions/theory/[slug]';
import { onRequestGet as onRequestGetDe } from '../functions/de/theory/[slug]';

const INDEX = readFileSync('index.html', 'utf8');

async function callFunction(path: string, env: Record<string, unknown>) {
  const assets = { fetch: async () => new Response(INDEX, { headers: { 'content-type': 'text/html' } }) };
  const request = new Request(`https://conspiracy-atlas.pages.dev${path}`);
  const { pathname } = new URL(request.url);
  const slug = pathname.split('/').pop()!;
  const handler = pathname.startsWith('/de/') ? onRequestGetDe : onRequestGet;
  return (handler as any)({ request, env: { ...env, ASSETS: assets }, params: { slug } }) as Promise<Response>;
}

describe('link previews', () => {
  it('builds preview data for a published case with an absolute photo URL', async () => {
    const env = await makeEnv();
    const og = await loadOg(Db.from(env), 'area-51', 'en', 'https://conspiracy-atlas.pages.dev');
    expect(og?.title).toBe('Area 51');
    expect(og?.image).toMatch(/^https:\/\/conspiracy-atlas\.pages\.dev\/og\/theory\/area-51\.png\?v=[a-z0-9]+$/);
    expect(og?.imageAlt).toBe('Area 51 — Unverified');
    expect(og?.imageWidth).toBe(800);
    expect(og?.url).toBe('https://conspiracy-atlas.pages.dev/theory/area-51');
    expect(og!.description.length).toBeLessThanOrEqual(200);
    const de = await loadOg(Db.from(env), 'moon-landing-conspiracy-theory', 'de', 'https://x.test');
    expect(de?.title).toBe('Verschwörungstheorie zur Mondlandung');
    expect(de?.image).toMatch(/^https:\/\/x\.test\/og\/de\/theory\/moon-landing-conspiracy-theory\.png\?v=[a-z0-9]+$/);
    expect(de?.imageAlt).toContain('—');
    expect(de?.url).toBe('https://x.test/de/theory/moon-landing-conspiracy-theory');
    const fr = await loadOg(Db.from(env), 'area-51', 'fr', 'https://x.test');
    expect(fr?.title).toBe('Zone 51');
    expect(fr?.image).toMatch(/^https:\/\/x\.test\/og\/fr\/theory\/area-51\.png\?v=[a-z0-9]+$/);
    expect(fr?.imageAlt).toContain('Non vérifié');
    expect(await loadOg(Db.from(env), 'does-not-exist', 'en', 'https://x.test')).toBeNull();
  });

  it('injects escaped tags and replaces the default ones', () => {
    const html = injectOg(INDEX, { title: 'A "quoted" <case>', description: 'x & y', url: 'https://x.test/theory/a', image: 'https://x.test/i.jpg', locale: 'en' });
    expect(html).toContain('<title>A &quot;quoted&quot; &lt;case&gt; – The Conspiracy Atlas</title>');
    expect(html).toContain('<meta property="og:description" content="x &amp; y" />');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('<case>');
    expect(clip('word '.repeat(100), 50).length).toBeLessThanOrEqual(50);
    expect(snippet('Short text.')).toBe('Short text.');
    const long = 'The U.S. Navy reported two attacks in the Gulf of Tonkin in 1964. The first attack took place on 2 August. The second, reported on 4 August, almost certainly did not happen and was used to justify war.';
    const s = snippet(long);
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s).toMatch(/[a-z0-9)"”][.!?]$/);
    expect(s).toContain('U.S. Navy');
    expect(snippet('word '.repeat(100))).toMatch(/…$/);
    expect(snippet('word '.repeat(100)).length).toBeLessThanOrEqual(160);
  });

  it('serves case pages with preview tags and falls back to the plain page', async () => {
    const env = await makeEnv();
    const page = await callFunction('/theory/cointelpro', env as any);
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('<meta property="og:title" content="COINTELPRO" />');
    expect(html).toContain('<div id="root"></div>');
    const missing = await (await callFunction('/theory/nope', env as any)).text();
    expect(missing).toBe(INDEX);
    const noDb = await (await callFunction('/theory/cointelpro', { ...env, DB: undefined } as any)).text();
    expect(noDb).toBe(INDEX);
  });
});

describe('search engines', () => {
  it('adds hreflang links, the page language and escaped structured data to case pages', async () => {
    const env = await makeEnv();
    const html = await (await callFunction('/de/theory/cointelpro', env as any)).text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<link rel="alternate" hreflang="en" href="https://conspiracy-atlas.pages.dev/theory/cointelpro" />');
    expect(html).toContain('<link rel="alternate" hreflang="de" href="https://conspiracy-atlas.pages.dev/de/theory/cointelpro" />');
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://conspiracy-atlas.pages.dev/theory/cointelpro" />');
    expect(html).toContain('<link rel="canonical" href="https://conspiracy-atlas.pages.dev/de/theory/cointelpro" />');
    const en = await (await callFunction('/theory/cointelpro', env as any)).text();
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('<link rel="canonical" href="https://conspiracy-atlas.pages.dev/theory/cointelpro" />');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!);
    expect(ld['@type']).toBe('Article');
    expect(ld.inLanguage).toBe('de');
    expect(ld.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const evil = jsonLd({ title: '</script><script>alert(1)</script>', description: '', url: 'https://x.test', image: 'https://x.test/i.jpg', locale: 'en' });
    expect(evil.match(/<\/script>/g)).toHaveLength(1);
  });

  it('lists published cases and overview pages in the sitemap with both languages', async () => {
    const env = await makeEnv();
    const res = await (sitemap as any)({ request: new Request('https://conspiracy-atlas.pages.dev/sitemap.xml'), env });
    const xml = await res.text();
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(xml).toContain('<loc>https://conspiracy-atlas.pages.dev/theory/area-51</loc>');
    expect(xml).toContain('hreflang="de" href="https://conspiracy-atlas.pages.dev/de/theory/area-51"');
    expect(xml).toContain('<loc>https://conspiracy-atlas.pages.dev/de/theory/area-51</loc>');
    expect(xml).toContain('<loc>https://conspiracy-atlas.pages.dev/de</loc>');
    expect(xml).not.toContain('?lang=');
    expect(xml).toContain('<loc>https://conspiracy-atlas.pages.dev/timeline</loc>');
    expect(xml).not.toContain('/admin');
    expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    const off = await (sitemap as any)({ request: new Request('https://x.test/sitemap.xml'), env: { ...env, DB: undefined } });
    expect(off.status).toBe(503);
    expect(await off.text()).toBe('Currently unavailable!');
  });
});

describe('language URLs', () => {
  it('moves old ?lang= case links permanently to the language URL', async () => {
    const env = await makeEnv();
    const old = await callFunction('/theory/cointelpro?lang=de', env as any);
    expect(old.status).toBe(301);
    expect(old.headers.get('location')).toBe('https://conspiracy-atlas.pages.dev/de/theory/cointelpro');
    const back = await callFunction('/de/theory/cointelpro?lang=en', env as any);
    expect(back.headers.get('location')).toBe('https://conspiracy-atlas.pages.dev/theory/cointelpro');
  });

  it('serves German case pages through their own Function route', () => {
    const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8'));
    expect(routes.include).toContain('/de/theory/*');
    expect(routes.include).toContain('/fr/theory/*');
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Disallow: /de/admin');
  });
});

describe('search console', () => {
  it('serves the verification file byte for byte without a redirect', async () => {
    const res = await (verification as any)({});
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('google-site-verification: googlee808fb02e2c3ca02.html');
  });
});
