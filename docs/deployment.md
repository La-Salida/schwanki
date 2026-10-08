# Schwanki deployment

The web app and landing page use Cloudflare Workers Static Assets. Supabase
project `oiemotutqshdohmfhtdw` provides authentication, Postgres, storage, and Edge
Functions. The recording extension remains private until its installed-extension
acceptance checks and Chrome Web Store release are complete.

## Current state — October 8, 2026

- Staging: https://schwanki-staging.yj-3e3.workers.dev
- Intended production: https://schwanki.yj-3e3.workers.dev (not deployed yet).
- Staging uses the existing production Supabase backend. Imports and reviews
  performed on staging affect real account data; this is a frontend preview,
  not an isolated backend environment.
- Supabase's saved redirect allow list contains both Worker origins with `/**`,
  plus the existing GitHub Pages and local development redirects.
- The default Supabase Site URL still points to GitHub Pages. Change it to the
  production Worker origin after the production release is ready.
- The staging sign-in button reaches Google's account chooser. Complete sign-in
  and the Sheets/PDF smoke test before promoting to production.
- No `DEEPSEEK_API_KEY` is configured in the backend. Live parsing is blocked.
- GitHub has the hosted `VITE_SUPABASE_URL` variable and the public client key
  stored as `VITE_SUPABASE_ANON_KEY`. `CLOUDFLARE_API_TOKEN` is still required;
  automatic production deployment remains disabled.

## Parser configuration

Add `DEEPSEEK_API_KEY` in Supabase's Edge Function secrets; never put provider
credentials in Vite variables or Git. `parse-worker` defaults to the DeepSeek
provider and `deepseek-v4-flash`. `PARSE_PROVIDER` and `PARSE_MODEL` can override
the defaults. OpenRouter and Anthropic remain available through their respective
API keys. Model responses still pass the existing card validation and approval
flow; truncated or invalid JSON is rejected.

Once the key is available, deploy the parser with explicit release authorization:

```sh
supabase functions deploy parse-worker --project-ref oiemotutqshdohmfhtdw
```

Verify an authenticated PDF import reaches the review Inbox, correct a missing
reading or meaning, approve the cards, then review them. Connect a consented
Google Sheet, import it, add a new row, sync again, and verify no duplicate cards.
Do not use private lesson documents as repository fixtures.

## Frontend releases

Read `RUNBOOK.md` for the workspace checks. Deployment scripts validate the
hosted HTTPS Supabase URL and reject browser-inappropriate secret/service keys.
Only public client configuration is bundled into the SPA. Configure it in
`apps/web/.env.staging.local` and `apps/web/.env.production.local` using
`apps/web/.env.example` as a template. Local development can continue to use
`apps/web/.env` with a local Supabase instance.

From `apps/web`, use the pinned package manager:

```sh
corepack pnpm test:deployment
corepack pnpm build:staging
corepack pnpm deploy:staging
corepack pnpm build:production
corepack pnpm deploy:production
```

Deployment requires explicit authorization under the runbook. After release,
check the landing page, `/signin`, an authenticated route, Google OAuth return,
and service worker update behavior. Keep the extension IDs allow list empty
until a stable, tested extension ID is available.

## GitHub releases

`.github/workflows/deploy-web.yml` supports manual staging and production
releases. A push to `main` deploys production only after the repository variable
`WEB_AUTO_DEPLOY_ENABLED` is set to `true`. Leave it unset until the smoke tests
pass and the production release is authorized.

Configure these in the chosen GitHub environment (`staging` or `production`),
or at repository level if shared:

| Setting | Kind | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | Deployment token scoped to the Schwanki account |
| `VITE_SUPABASE_URL` | Variable | `https://oiemotutqshdohmfhtdw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Secret | Supabase anon or publishable client key |
| `VITE_EXTENSION_IDS` | Variable | Empty until the private extension is ready |
| `VITE_VAPID_PUBLIC_KEY` | Variable | Optional public push key |

The workflow runs workspace tests, deployment configuration tests, type checking,
and web lint before building and publishing. Backend releases remain separate;
the frontend workflow does not apply schema migrations or publish Edge Functions.

After a successful production release, set Supabase's Site URL to
`https://schwanki.yj-3e3.workers.dev/`. Preserve existing redirect entries while
legacy clients may still need them. A future custom domain must be added to the
Worker and Supabase redirect allow list before it replaces this origin.
