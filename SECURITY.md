# Security

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private
reporting instead: *Security → Report a vulnerability* in this repository.

## How this repository stays safe while public

- No secrets are stored in the repository or its history. The Turnstile secret key, the
  admin login and the session secret exist only as Cloudflare secrets
  (`npx wrangler pages secret put …`, see docs/DEPLOYMENT.md). `.dev.vars`, `.env` files and
  database backups are git-ignored, and `tests/repo-security.test.ts` fails if one is committed.
- Values in `wrangler.toml` (Turnstile *site* key, D1 database id, feature flags) are public by
  design; nobody can use them without the owner's Cloudflare login.
- Only the owner can push to this repository. Pull requests from forks run CI with read-only
  permissions and without any secrets; workflows never use `pull_request_target`.
- GitHub Actions are pinned to commit SHAs and kept current by Dependabot.
