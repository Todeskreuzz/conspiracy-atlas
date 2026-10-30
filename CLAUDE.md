# Notes for Claude

- **Free-only.** Never add bindings or code for R2, KV, Queues, Durable Objects, Workers AI,
  Vectorize, Images, Stream, Browser Rendering or any paid API. `npm run cost-check` must pass.
  Never create Cloudflare resources or change billing; deployment is done by the owner (docs/DEPLOYMENT.md).
- **No secrets** in files, logs or commits. Secrets are set with `wrangler pages secret put`.
- Unavailable features must show `Currently unavailable!` (shared/availability.ts), never a fake success.
- Layout: `src/` frontend, `server/` API (Hono), `functions/api/[[path]].ts` entry, `shared/` code used by
  both, `migrations/d1/` schema + generated seed (`node scripts/generate-seed.mjs` from `data/seed.mjs`).
- SQL is always parametrised; D1 allows max 100 bound parameters per statement (chunk at 90).
- Rich text is TipTap JSON validated by `shared/richtext.ts`; never render HTML from users.
- Archive content: facts and claims stay separate; cite only real, verifiable sources; never invent
  documents or connections. Community and investigation connections are always `suggested`.
- Before committing: `npm run typecheck && npm test && npm run cost-check && npm run build`.
- Every UI string goes into both `src/i18n/locales/en.json` and `de.json`.
