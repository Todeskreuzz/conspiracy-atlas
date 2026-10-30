# Deployment (Cloudflare Free only)

> **Cost rules.** Only Cloudflare **Pages Free**, **Workers Free** (Pages Functions),
> **D1** (included in Workers Free) and **Turnstile Free** are used. Never activate
> Workers Paid, R2, Images, Stream, Workers AI, Queues, Durable Objects, Vectorize,
> Browser Rendering, Cache Reserve, Argo or any other paid or usage-billed product.
> If a dashboard or wrangler shows "Upgrade required", "Add billing information",
> "Paid plan required" or similar, **stop** and do not continue.
>
> `npm run cost-check` verifies statically that no such binding exists. It cannot see
> your account plan; check it yourself under *Workers & Pages → Plans* (must say **Free**).

All steps run on your own machine. No secret is ever written into a file of this repository.

## 1. Log in
```bash
npx wrangler login          # opens the browser, you confirm the login yourself
npx wrangler whoami         # check the account
```

## 2. Create the D1 database (free)
```bash
npx wrangler d1 create conspiracy-atlas-db
```
Copy the printed `database_id` into `wrangler.toml` (`[[d1_databases]]`). The id is not a secret.

## 3. Apply migrations (schema + seed archive)
```bash
npm run db:migrate:remote
```

## 4. Create the Pages project and deploy
```bash
npm ci && npm run build
npx wrangler pages project create conspiracy-atlas --production-branch main
npx wrangler pages deploy dist --project-name conspiracy-atlas
```
The site is then available at https://conspiracy-atlas.pages.dev.

**Production setup (since 30 October 2026): Git-connected, deploys automatically.**
The live project is connected to this GitHub repository, so every merge into `main` is built
and published by Cloudflare Pages (Free: 500 builds per month). Settings:
production branch `main`, framework preset *None*, build command
`npm run cost-check && npm run build`, output `dist`; D1 binding and variables come from
`wrangler.toml`. A project created by direct upload cannot be switched to Git later; it has to be
deleted and recreated via *Workers & Pages → Create application → "Looking to deploy Pages?" →
Import an existing Git repository* in the account that owns the D1 database, after which the
secrets (step 5) must be set again. Secrets only take effect on the next deployment.
Database migrations are never applied automatically; run `npm run db:migrate:remote` by hand.

## 5. Secrets (you enter the values yourself)
```bash
npm run hash-password                                   # prints a PBKDF2 hash, the password is never stored
npx wrangler pages secret put ADMIN_USERNAME      --project-name conspiracy-atlas
npx wrangler pages secret put ADMIN_PASSWORD_HASH --project-name conspiracy-atlas
npx wrangler pages secret put SESSION_SECRET      --project-name conspiracy-atlas   # 32+ random characters
```
Without these secrets the admin panel shows "Currently unavailable!".

## 6. Turnstile (optional, free)
Community submissions and reports require Turnstile. Until it is set up they show
"Currently unavailable! Anti-spam verification has not been configured."
1. Dashboard → *Turnstile* → *Add widget* (Free), hostname `conspiracy-atlas.pages.dev`.
2. Put the **site key** into `wrangler.toml` (`TURNSTILE_SITE_KEY`) and set `FEATURE_TURNSTILE = "true"`.
3. `npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name conspiracy-atlas`
4. Rebuild and deploy.

## 7. Automatic archive import (free)
`FEATURE_AUTOMATIC_IMPORT = "true"` enables `POST /api/import/run`. Each run takes up to 6 Wikidata items
that are a *conspiracy theory* (Q159535, incl. subclasses up to two levels) with an English Wikipedia article, then the theory
articles linked from Wikipedia's *List of conspiracy theories* (people, places and other links are
skipped by their short description), skips everything already in the archive and stores the rest neutrally: the Wikipedia lead text (CC BY-SA 4.0,
attributed and linked), the article as source, a German title and summary if a German article exists.
No claims, ratings or connections are derived. The endpoint needs no secret and runs at most every
20 minutes. Each run then fills up to 6 imported entries (new ones first, older ones step by step) from
the full article text: the whole lead as summary, the origin and background sections, the article's
other sections under *In detail*, and the central claims as the article states them (one claim per
subsection of a "Claims" section, otherwise the article's sentences saying what proponents claim;
sections about criticism or rebuttals are never used as claims). Finally it adds up to 10 cover
real photos from Wikimedia Commons, only with a free licence, tried in this order: the article's lead
image, the Wikidata image (P18), the Wikidata images of the people, places, organisations and works the
theory is about, other photos in the article (no icons, logos or flags) and a Commons search for the
title (up to 5 per run). They are stored in D1 with author and licence shown on the image. Nothing is
generated: a case for which no free photo is found gets the real symbol photo of its category
(`SYMBOL_IMAGES` in `server/importer.ts`, all freely licensed Commons photographs, stored once in D1),
shown with the caption "Symbolbild" / "Symbol image" and its credit. A run stops fetching after 45
requests, below the 50 subrequests of Workers Free.

The run is started every 3 hours by the cron Worker in `workers/import-cron/` (Workers Free, Cron
Trigger, no bindings, no public URL). Deploy it once, after `npx wrangler login`:
```bash
npm run deploy:import-cron     # = npx wrangler deploy --config workers/import-cron/wrangler.toml
```
It then appears as `conspiracy-atlas-import-cron` under *Workers & Pages*; its runs and log lines are
listed there under *Logs* / *Cron Events*. `.github/workflows/import.yml` stays as a backup (GitHub
pauses scheduled workflows after 60 days without repository activity; it can also be started by hand
under *Actions → Archive import → Run workflow*). Both use the same schedule, and the 20-minute lock
makes the second call a harmless 429. The admin API can start a run too (`POST /api/admin/import/run`);
the last result is shown under Admin → *Services*. Set the flag to `"false"` to stop the import, or
remove the Worker with `npx wrangler delete --config workers/import-cron/wrangler.toml`.

## 8. Verify
- `https://conspiracy-atlas.pages.dev/api/health` → `{"ok":true,...}`
- Admin → *Services* shows each service, its state and a connection test.

## Free limits (as documented by Cloudflare; re-check the current pages)
- Workers Free: 100,000 requests/day (Pages Functions count against it), 10 ms CPU per request.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage.
- Pages Free: 500 builds/month; static asset requests are free.
- Turnstile: free.
When a daily limit is reached, Cloudflare returns errors instead of billing; the site then
shows "Currently unavailable!" for the affected features. Exceeding Workers Free limits does
not upgrade the account automatically. This is not a guarantee of zero cost: always keep the
account on the Free plan and do not add paid products.

## Backups
```bash
npm run backup:remote                         # writes backups/<time>-remote.sql and .json
npm run restore:remote -- backups/<file>.json # makes a fresh backup first, then restores
```
The admin panel also offers JSON/CSV downloads (*Backup*).

Community images live in the D1 table `images`. They are included in the `.sql` backup only;
the JSON backup leaves them out (too large), and a JSON restore removes the images of the
submissions it replaces. Use the `.sql` file to keep images.

The new image table is created by the migration `0003_images.sql`; run
`npm run db:migrate:remote` (step 3) before deploying this version.
