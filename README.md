# The Conspiracy Atlas

*An interactive global archive of theories, mysteries and connections.*

The Conspiracy Atlas documents conspiracy theories the way an archivist would: every
theory has a permanent page, an evidence status, sourced claims, counter-arguments and
its documented connections. Historical facts and further claims are always kept apart.

## Features
- **Investigation wall** – Cytoscape.js board with cards for theories, events, organisations,
  people, places, documents, technologies, claims and sources. Red threads distinguish
  documented, claimed, thematic, temporal, unresolved and counter connections. Pan, zoom,
  drag & drop, double-click focus, minimap, filters, grouping, fullscreen and saved views.
  Positions and threads are stored in D1. Stress test: `/wall?stress=1000`.
- **Archive** – 10 categories, 7 evidence statuses, search, filters, pagination, detail pages
  with permanent URLs (`/theory/<slug>`).
- **Sources & evidence** – primary/secondary sources, each tied to the specific claim it
  supports, refutes or documents.
- **Timeline** – years / decades / centuries, filters, zoom, connections.
- **World map** – Leaflet with bundled Natural Earth country outlines (no tiles, no map API).
- **Community submissions** – rich-text editor, sources, links, tags, counter-arguments,
  related events, linked theories, preview, named or anonymous. Moderation queue
  (Draft → Pending Review → Approved / Rejected / Changes requested → Published / Withdrawn).
  Published contributions appear on the wall with *suggested* connections.
- **Investigation Mode** – private projects with notes, hypotheses (never shown as facts),
  sources, counter-arguments, timeline entries and a private board.
- **Admin panel** – moderation, reports, archive editing, service status, backups.
- **English & German**, extensible (`src/i18n/locales`).
- **Availability system** – every unavailable feature shows "Currently unavailable!" with
  the reason; there are no endless spinners and no fake successes.

## Stack
React 19 · TypeScript · Vite · Cytoscape.js · TipTap · Leaflet · Hono on Cloudflare Pages
Functions · Cloudflare D1. Free-only: see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local development
Requires Node.js ≥ 22.5.
```bash
npm ci
cp .dev.vars.example .dev.vars        # then fill ADMIN_PASSWORD_HASH (npm run hash-password) and SESSION_SECRET
npm run db:migrate:local              # local D1 (schema + seed archive)
npm run dev:full                      # API + site on http://localhost:8788
# or, in two terminals: `npm run dev:full` and `npm run dev` (Vite with HMR on :5173, proxies /api)
```

## Scripts
| Script | Purpose |
|---|---|
| `npm test` | unit, integration and frontend tests (Vitest, in-memory D1) |
| `npm run perf:wall` | wall layout/model with 100, 500 and 1000 nodes |
| `npm run build` | typecheck + static build into `dist/` |
| `npm run cost-check` | fails if a paid binding or a non-allow-listed external host appears |
| `npm run check-sources` | checks that every seed source URL is reachable |
| `npm run hash-password` | creates the admin password hash locally |
| `npm run backup:local` / `backup:remote` | SQL + JSON backup into `backups/` |
| `npm run restore:local` / `restore:remote -- <file>` | restore (always backs up first) |
| `npm run db:reset:local` | recreate the local database |

## Configuration
Feature switches live in `wrangler.toml` `[vars]`:
`FEATURE_COMMUNITY_SUBMISSIONS`, `FEATURE_COMMUNITY_UPLOADS` (images, compressed in the browser and stored in D1;
`IMAGE_STORAGE_LIMIT_MB` caps the total, default 250, max 400 – no R2),
`FEATURE_MAP_DATA`, `FEATURE_AUTOMATIC_IMPORT`, `FEATURE_TURNSTILE`, `FEATURE_ADMIN_PANEL`,
`FEATURE_INVESTIGATIONS`, `FEATURE_REPORTS`. Secrets are set with
`wrangler pages secret put` (see the deployment guide).

## Sources
The seed archive cites real publications only. The URLs could not be checked from the
build environment, so `last_checked` is empty until `npm run check-sources` has been run
and the results reviewed by hand.

## Privacy
No accounts for readers, no analytics, no third-party scripts except Cloudflare Turnstile on
forms. IP addresses are never stored: rate limits use salted hashes that are deleted after a day.
Investigation projects are bound to a random key stored only in the browser.

## Licenses
See [LICENSES.md](LICENSES.md).
