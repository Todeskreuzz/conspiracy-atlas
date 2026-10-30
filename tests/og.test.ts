import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeEnv } from './helpers/app';
import { Db } from '../server/db';
import { clip, injectOg, loadOg } from '../server/og';
import { onRequestGet } from '../functions/theory/[slug]';

const INDEX = readFileSync('index.html', 'utf8');

async function callFunction(path: string, env: Record<string, unknown>) {
  const assets = { fetch: async () => new Response(INDEX, { headers: { 'content-type': 'text/html' } }) };
  const request = new Request(`https://conspiracy-atlas.pages.dev${path}`);
  const slug = new URL(request.url).pathname.split('/').pop()!;
  return (onRequestGet as any)({ request, env: { ...env, ASSETS: assets }, params: { slug } }) as Promise<Response>;
}

describe('link previews', () => {
  it('builds preview data for a published case with an absolute photo URL', async () => {
    const env = await makeEnv();
    const og = await loadOg(Db.from(env), 'area-51', 'en', 'https://conspiracy-atlas.pages.dev');
    expect(og?.title).toBe('Area 51');
    expect(og?.image).toBe('https://conspiracy-atlas.pages.dev/media/theories/area-51.jpg');
    expect(og?.url).toBe('https://conspiracy-atlas.pages.dev/theory/area-51');
    expect(og!.description.length).toBeLessThanOrEqual(200);
    const de = await loadOg(Db.from(env), 'moon-landing-conspiracy-theory', 'de', 'https://x.test');
    expect(de?.title).toBe('Verschwörungstheorie zur Mondlandung');
    expect(de?.url).toBe('https://x.test/theory/moon-landing-conspiracy-theory?lang=de');
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
