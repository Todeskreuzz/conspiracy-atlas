// Free Cloudflare Worker whose only job is a Cron Trigger: every 3 hours it calls the site's
// public import endpoint. It has no bindings and no public URL. The endpoint itself refuses to
// run more than once every 20 minutes, so the GitHub Actions schedule can stay as a backup.

export const IMPORT_URL = 'https://conspiracy-atlas.pages.dev/api/import/run';

export async function runImport(fetcher: typeof fetch = fetch): Promise<void> {
  const res = await fetcher(IMPORT_URL, { method: 'POST', headers: { 'User-Agent': 'ConspiracyAtlasImportCron/1.0' } });
  const body = (await res.text()).slice(0, 2000);
  // 429 = another run happened shortly before; that is fine.
  if (!res.ok && res.status !== 429) throw new Error(`Import failed with HTTP ${res.status}: ${body}`);
  console.log(`Import HTTP ${res.status}: ${body}`);
}

export default {
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(runImport());
  },
};
