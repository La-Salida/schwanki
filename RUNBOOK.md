# Schwanki runbook

Verified from the root and workspace `package.json` scripts on 2026-10-05.
Use Node 22+ and pnpm 9.15.0 (root `packageManager`). Run from the repository root.
On hosts with an older global pnpm, use `COREPACK_HOME=/private/tmp/schwanki-corepack`
and `corepack pnpm` in place of `pnpm`. `rtk proxy` forwards unsupported commands
without hiding their diagnostics.
Prefix listings, dependency installs, builds, tests and status commands with
`'/Users/yjkim/Library/Application Support/Headroom/headroom/bin/rtk'`.
Read source and run `git diff --check` without RTK.

## Install and verify

- `pnpm install --frozen-lockfile`
- `pnpm test` — recursive workspace tests, skipping packages without a test script.
  Web tests import the Supabase client even when testing pure helpers. In a clean
  worktree without `.env`, prefix tests/builds with
  `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=local-test-placeholder`.
  These values initialize test clients; they are not live credentials.
- `pnpm typecheck` — recursive workspace TypeScript checks.
- `pnpm test:classes` — real PostgreSQL schema/RLS/approval tests in PGlite plus
  actual ffmpeg media tests. PGlite serializes calls.
- `SCHWANKI_CLASS_NATIVE=1 node --test scripts/test-class-schema.mjs` — repeat SQL
  tests and multi-session concurrent approval against native PostgreSQL 17 using
  the installed `postgres:17-alpine` Docker image. Creates/removes only a named
  disposable test container, with no network, volumes, host ports or production keys.
  This focused baseline/new-migration test does not certify the complete Supabase
  migration chain, Storage or pg_cron.
- `pnpm --filter @schwanki/web build` — TypeScript project build and Vite PWA build.
- `pnpm --filter @schwanki/web lint` — oxlint.
- `deno test --config supabase/functions/deno.json --allow-env --allow-read --allow-net supabase/functions` — Edge tests;
  network permission is for imported dependencies, not production invocation.
- `bash scripts/vendor-edge.sh` — regenerate Edge sources after package edits.
- `bash scripts/check-vendor.sh` — regeneration and vendor drift check.
- `git diff --check` — whitespace errors (raw command).

## Development

- `pnpm dev` — web workspace Vite server.
- `pnpm --filter @schwanki/extension build` — local MV3 capture spike.
- `pnpm --filter @schwanki/extension test` — manifest, capture policy and local store tests.
- `pnpm --filter @schwanki/extension typecheck` — extension TypeScript checks.
- `node scripts/serve-class-spike.mjs` — loopback-only synthetic classroom, port 4179.
- `node scripts/verify-class-media.mjs /absolute/path/to/export` — verify checksums,
  assemble ordered media parts, remux and fully decode with installed ffmpeg/ffprobe.
  See `docs/class-recording-spike.md` for the real Chrome acceptance protocol.
- `node --test scripts/verify-class-media.test.mjs` — synthetic media verification
  with actual ffmpeg; does not certify Chrome capture.
- `node scripts/benchmark-class-media.mjs` — accelerated hour-long two-channel
  native synthetic encode/decode benchmark; writes aggregate evidence only.
  This is media-runtime evidence, not an hour-long Chrome recording.
- `node scripts/benchmark-class-transcription.mjs openai /private/path/sample.json /private/path/results --consented`
  — one explicitly authorized, at-most-five-minute provider comparison request;
  needs OPENAI_API_KEY. For elevenlabs use ELEVENLABS_API_KEY and additionally
  `--zero-retention` (enterprise eligible) or `--allow-provider-retention`.
  Never commit sample audio, transcripts, attempt receipts or provider keys.

## Release boundary

No extension publication, production deployment, or merge to main without approval.
Feature branches use `codex/`. Commit/push validated work, recording open manual
acceptance gates. The capture spike is local-only; its limits are provisional,
and no production processing quote is available yet.
