# Schwanki

A modern take on Anki: spaced repetition you scroll like a social feed.

- **Review:** on a phone, due cards play as a full-screen swipe feed (swipe up
  for Good, left for Again, right for Easy). FSRS still decides what comes next.
  On a desktop you get the flashcard with its rating row.
- **Bring your cards:** import Anki decks (`.apkg` / `.colpkg`) with their
  scheduling, review history, pictures and audio. That's the main way in.
- **Keep adding words:** connect class notes (Google Sheets/Docs, PDFs, Canva,
  Preply) and new words land in the Inbox for you to approve.
- **Make it memorable:** AI example sentences with the word highlighted, plus
  images and audio. Use Schwanki AI credits or your own keys.

Live at https://schwankiapp.com. The web app is a PWA. An iPhone companion is
under development; see [native setup](apps/ios/README.md).

## Docs

- `DESIGN.md`: product and design direction (feed + notebook surfaces).
- `docs/working-scope.md`: what's in scope now and what's deferred.
- `docs/brand/copy.md`: voice guide for every user-facing string.
- `docs/superpowers/specs/`: original design specs (read the direction update at
  the top of `2026-09-23-schwanki-design.md` first).
- `RUNBOOK.md` and `docs/deployment.md`: commands, releases, environments.

## Layout

- `apps/web`: React + Vite PWA (review feed, Inbox, Decks & notes, Settings).
- `apps/ios`: Expo / React Native companion (Anki import, review, offline sync).
- `apps/extension`: Chrome extension spike for recording classes (deferred).
- `packages/core`: FSRS scheduling, sessions, Supabase API client.
- `packages/anki`: shared Anki package parsing and import planning.
- `packages/parsing`: turns class notes into card candidates.
- `packages/mnemonic`: AI media providers and model catalog.
- `packages/classes`: class recording extraction (deferred feature).
- `supabase/`: migrations and Edge Functions (sync, parsing, credits, push).

## Develop

```sh
pnpm install
pnpm dev        # web app
pnpm test
pnpm typecheck
```

See `RUNBOOK.md` for builds, Edge Function checks and deploys.
