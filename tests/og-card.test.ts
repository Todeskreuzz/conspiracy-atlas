import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STATUS_COLORS } from '../src/components/Badges';
import { EVIDENCE_STATUSES } from '../shared/constants';
import { font, measure, wrap } from '../server/preview/atlas';
import { fittedTitleWidth, renderCaseCard, renderHomeCard, STATUS_INK, titleLines } from '../server/preview/card';
import { serveOg } from '../server/preview/serve';
import { serveHome } from '../server/homePage';
import { statusLabel } from '../server/preview/copy';
import { makeEnv } from './helpers/app';

function readPng(png: Uint8Array) {
  expect(png[0]).toBe(137);
  expect(String.fromCharCode(...png.subarray(1, 4))).toBe('PNG');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  const pixels: Uint8Array[] = [];
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(3);
    }
    if (type === 'IDAT') pixels.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(pixels.map((part) => Buffer.from(part))));
  return { width, height, raw };
}

describe('preview cards', () => {
  it('uses the same status names and colours as the badges', () => {
    expect(STATUS_INK).toEqual(STATUS_COLORS);
    for (const status of EVIDENCE_STATUSES) {
      expect(statusLabel('en', status).length).toBeGreaterThan(3);
      expect(statusLabel('de', status)).not.toBe(statusLabel('en', status));
    }
    expect(statusLabel('de', 'debunked')).toBe('Widerlegt');
    expect(statusLabel('en', 'historically_documented')).toBe('Historically documented');
  });

  it('draws a case card with the title and the evidence label, and a home card', () => {
    const png = renderCaseCard({
      locale: 'de',
      title: 'Verschwörungstheorie zur Mondlandung',
      summary: 'Die Landung ist belegt. Weitere Behauptungen bleiben unbelegt.',
      status: 'partially_supported',
      host: 'conspiracy-atlas.pages.dev',
    });
    const image = readPng(png);
    expect(image.width).toBe(800);
    expect(image.height).toBe(420);
    expect(image.raw.length).toBe(420 * 801);
    const other = renderCaseCard({ locale: 'en', title: 'Area 51', summary: 'A test site.', status: 'unverified', host: 'conspiracy-atlas.pages.dev' });
    expect(Buffer.from(other).equals(Buffer.from(png))).toBe(false);
    const home = readPng(renderHomeCard('en'));
    const homeDe = readPng(renderHomeCard('de'));
    expect(home.width).toBe(800);
    expect(Buffer.from(home.raw).equals(Buffer.from(homeDe.raw))).toBe(false);
  });

  it('keeps long titles inside the card and knows German letters', () => {
    const title = 'A very long case title that cannot fit on a single line of the preview card no matter the type size';
    const lines = titleLines(title);
    expect(lines.length).toBeGreaterThan(1);
    expect(fittedTitleWidth(title)).toBeLessThanOrEqual(660);
    const display = font('display-md');
    expect(measure(display, 'ÄÖÜß')).toBeGreaterThan(measure(display, 'A'));
    expect(wrap(display, 'Area 51', 980, 3)).toEqual(['Area 51']);
  });

  it('serves png cards and refuses missing cases without dropping the frame denial', async () => {
    const env = await makeEnv();
    const home = await serveOg({ request: new Request('https://conspiracy-atlas.pages.dev/og/home.png'), env, params: { path: ['home.png'] } });
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toBe('image/png');
    expect(home.headers.get('x-frame-options')).toBe('DENY');
    expect(home.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const card = readPng(new Uint8Array(await home.arrayBuffer()));
    expect(card.width).toBe(800);

    const area = await serveOg({
      request: new Request('https://conspiracy-atlas.pages.dev/og/de/theory/area-51.png'),
      env,
      params: { path: ['de', 'theory', 'area-51.png'] },
    });
    expect(area.status).toBe(200);
    expect(area.headers.get('cache-control')).toContain('max-age=86400');
    const missing = await serveOg({ request: new Request('https://x.test/og/theory/nope.png'), env, params: { path: 'theory/nope.png' } });
    expect(missing.status).toBe(404);
    const down = await serveOg({
      request: new Request('https://x.test/og/theory/area-51.png'),
      env: { ...env, DB: undefined },
      params: { path: ['theory', 'area-51.png'] },
    });
    expect(down.status).toBe(503);
    expect(await down.text()).toBe('Currently unavailable!');
  });

  it('puts German preview tags on the German homepage and keeps the asset headers', async () => {
    const index = readFileSync('index.html', 'utf8');
    const env = await makeEnv();
    const assets = {
      fetch: async () => new Response(index, { headers: { 'content-type': 'text/html', 'X-Frame-Options': 'DENY' } }),
    };
    const res = await serveHome(new Request('https://conspiracy-atlas.pages.dev/de'), { ...env, ASSETS: assets } as any, 'de');
    const html = await res.text();
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('og:image" content="https://conspiracy-atlas.pages.dev/og/de/home.png"');
    expect(html).toContain('Ein interaktives, weltweites Archiv');
    expect(html).toContain('og:type" content="website"');
    expect(html).not.toContain('og:type" content="article"');
    expect(html).toContain('"@type": "WebSite"');
    expect(readFileSync('index.html', 'utf8')).toContain('https://conspiracy-atlas.pages.dev/og/home.png');
    expect(readFileSync('public/_routes.json', 'utf8')).toContain('"/og/*"');
  });
});
