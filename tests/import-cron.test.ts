import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import worker, { runImport, IMPORT_URL } from '../workers/import-cron/index';

describe('import cron worker', () => {
  it('posts to the import endpoint and accepts 200 and 429', async () => {
    const ok = vi.fn(async () => new Response('{"imported":[]}', { status: 200 }));
    await runImport(ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledWith(IMPORT_URL, expect.objectContaining({ method: 'POST' }));
    await expect(runImport((async () => new Response('busy', { status: 429 })) as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it('fails loudly on other errors so the cron shows up as failed', async () => {
    await expect(runImport((async () => new Response('down', { status: 502 })) as unknown as typeof fetch)).rejects.toThrow('HTTP 502');
  });

  it('only has a scheduled handler and a cron trigger, no bindings', () => {
    expect(Object.keys(worker)).toEqual(['scheduled']);
    const toml = readFileSync('workers/import-cron/wrangler.toml', 'utf8');
    const sections = [...toml.matchAll(/^\[\[?([a-z0-9_.]+)\]?\]/gm)].map((m) => m[1]);
    expect(sections).toEqual(['triggers']);
    expect(toml).toMatch(/^workers_dev = false$/m);
  });
});
