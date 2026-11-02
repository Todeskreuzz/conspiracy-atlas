import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('discovery for new and returning visitors', () => {
  it('ships an installable web app manifest that the start page links', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.name).toBe('The Conspiracy Atlas');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(readFileSync('index.html', 'utf8')).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it('lets other sites embed the case of the day, and only there', () => {
    const headers = readFileSync('public/_headers', 'utf8').replace(/\r\n/g, '\n');
    expect(headers).toMatch(/\/embed\n {2}! X-Frame-Options\n {2}! Content-Security-Policy\n {2}Content-Security-Policy: .*frame-ancestors \*/);
    expect(headers).toMatch(/\/\*\n {2}X-Content-Type-Options: nosniff[\s\S]*X-Frame-Options: DENY/);
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('path="/embed/case-of-the-day"');
  });

  it('describes the site with a search action that the archive understands', () => {
    const html = readFileSync('index.html', 'utf8');
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(json['@type']).toBe('WebSite');
    expect(json.potentialAction['@type']).toBe('SearchAction');
    expect(json.potentialAction.target.urlTemplate).toContain('/archive?q={search_term_string}');
  });
});
