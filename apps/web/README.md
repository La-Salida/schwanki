# @schwanki/web

The Schwanki PWA: landing page, Anki import, the phone review feed, desktop
review, Inbox, Decks & notes, and Settings. React + Vite + Tailwind, backed by
Supabase.

- Design rules: `../../DESIGN.md`. Copy rules: `../../docs/brand/copy.md`.
- Dev server: `pnpm dev` from the repo root.
- Builds and deploys: `pnpm build:staging` / `pnpm build:production`; see
  `../../docs/deployment.md`.
- Build env: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
