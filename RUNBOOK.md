# Schwanki development runbook

Commands below come from the checked-in workspace scripts and Edge import map.
Use pnpm 9.15.0 (packageManager in package.json). Prefix builds, tests and status
commands with the Headroom RTK binary from the session instructions. Read source
and run git diff --check directly.

## Workspace

- Production/staging configuration and release status: `docs/deployment.md`.
- Deployment script checks: from `apps/web`, `corepack pnpm test:deployment`.
- Frontend release builds: from `apps/web`, `corepack pnpm build:staging` or
  `corepack pnpm build:production`. See the deployment guide for release commands
  and required credentials.

- Install workspace dependencies: `pnpm install`.
- Tests: `pnpm test` (runs each package's test script).
- Type checking: `pnpm typecheck` (runs each package's typecheck script).
- Web development: `pnpm dev`.
- Web build: `pnpm --filter @schwanki/web build`.
- Web lint: `pnpm --filter @schwanki/web lint`.
- Edge source check: `deno check --config supabase/functions/deno.json supabase/functions/parse-worker/index.ts`.
- PDF extraction checks, including a standalone deployment bundle:
  `deno test --allow-read --allow-write --allow-run supabase/functions/sync-pdf/pdf.test.ts supabase/functions/sync-pdf/pdf-bundle.test.ts`.
- PDF Edge source check: `deno check --config supabase/functions/deno.json supabase/functions/sync-pdf/index.ts`.
- PowerPoint uploads: the browser accepts .pptx files up to 100 MiB and extracts
  slide text before upload (10 MiB text limit), excluding images, audio, video,
  and speaker notes. PDFs retain their 10 MiB limit. Storage keeps the legacy
  `.pdf` object key for both formats; the Blob content type selects extraction.
  Deploy the updated `sync-pdf` function before releasing the frontend: older
  functions cannot read prepared PowerPoint text. No database migration is needed.
- Class pictures (whiteboard screenshots, photos): the browser shrinks them to a
  JPEG (max 2400 px edge) stored at the same legacy `.pdf` key with an image
  content type. `sync-pdf` reads them once with `openrouter/router/vision` on Fal
  (secret `FAL_API_KEY`; optional `VISION_MODEL`, default `google/gemini-2.5-flash`),
  and stores the picture's own hash as `content_hash`, so re-syncs never re-read
  an unchanged picture. Checks: `deno test --config supabase/functions/deno.json supabase/functions/sync-pdf/vision.test.ts`.
- PowerPoint/browser regression checks: from `apps/web`, run
  `corepack pnpm test src/lib/classDocument.test.ts src/components/SourceForm.test.tsx src/pages/Sources.test.tsx`.
- With explicit deployment authorization, release the PDF function using the
  checked-in import map:
  `supabase functions deploy sync-pdf --project-ref oiemotutqshdohmfhtdw --import-map supabase/functions/deno.json`.
- Vendor package source changes: `bash scripts/vendor-edge.sh`; generated files
  must accompany their source changes. `bash scripts/check-vendor.sh` checks
  committed vendor drift; it regenerates first.
- Credit billing checks: `deno test --config supabase/functions/deno.json supabase/functions/_shared/billing.test.ts supabase/functions/_shared/stripe.test.ts`.
- Credit Edge source check: `deno check --config supabase/functions/deno.json supabase/functions/credits/index.ts`.
- Credit fulfillment checks: `deno test --config supabase/functions/deno.json supabase/functions/stripe-webhook/handler.test.ts`.
- Webhook Edge source check: `deno check --config supabase/functions/deno.json supabase/functions/stripe-webhook/index.ts`.
- After explicit production deployment approval, release the credits function with the checked-in import map:
  `supabase functions deploy credits --project-ref oiemotutqshdohmfhtdw --import-map supabase/functions/deno.json`.
- Whitespace validation: `git diff --check`.

## iOS companion and local simulator

Use Node 24 and `corepack pnpm` (9.15.0). From `apps/ios`:

- Install native dependencies and run a development build on a booted simulator:
  `corepack pnpm ios --device <SIMULATOR_UDID>`.
- With the native build installed, keep Metro running using
  `env -u CI corepack pnpm exec expo start --dev-client --lan`.
  Expo disables file watching/Fast Refresh when `CI=1`; unset it for simulator
  work. Add `--clear` when restarting a server that served stale code.
- Native storage/import/review regressions: `corepack pnpm test`.
- Native source check: `corepack pnpm typecheck`.
- iOS Hermes bundle: `corepack pnpm exec expo export --platform ios --output-dir dist-ios`.
- Repeat the simulator sample-flow check with `fb-idb` and `idb_companion`
  installed: `SIMULATOR_UDID=<UUID> corepack pnpm test:simulator`.
  Open the app at its entry screen and dismiss the Expo developer menu first.
  This check taps native controls and swipes the feed; it uses sample cards only.
  Captures and its JSON report go to ignored `apps/ios/qa/output/native`.
  `IDB_BIN` may select a Python-venv executable, and `IDB_COMPANION=host:port`
  may select an already running companion. Starting one manually uses
  `idb_companion --udid <UUID> --grpc-port <PORT> --log-level info`.
- For the separate large-text bounds check, set that simulator to Accessibility
  Large, restart Schwanki, and open a sample card. Add `NATIVE_QA_MODE=large-text`
  to the simulator-test command. Restore the original text size after testing.

The companion uses the web backend only when its public native environment
values are configured; see `apps/ios/README.md` and `docs/ios-mac-setup.md`.
Sample-flow simulator acceptance does not validate hosted Google OAuth,
authenticated Files imports, notifications, or physical-device audio.

## RevenueCat iOS credit packs

Configuration, catalog IDs, and activation order: `docs/revenuecat-mobile.md`.
Purchases default to disabled until production fulfillment is approved and verified.

- Native billing checks: from `apps/ios`, `corepack pnpm test` and `corepack pnpm typecheck`.
- Atomic credit/refund database checks: from `packages/core`,
  `corepack pnpm test src/revenuecat-credits.test.ts`.
- Webhook checks:
  `deno test --config supabase/functions/deno.json supabase/functions/revenuecat-webhook/handler.test.ts`.
- Edge source check:
  `deno check --config supabase/functions/deno.json supabase/functions/revenuecat-webhook/index.ts supabase/functions/credits/index.ts`.
- Regenerate shared Edge code after credit catalog changes: `bash scripts/vendor-edge.sh`.
- After explicit production approval, apply only the reviewed pending migrations
  using the migration preview/release commands below. Configure the same random
  `REVENUECAT_WEBHOOK_SECRET` on Supabase and in RevenueCat's webhook Authorization
  header (`Bearer <secret>`). Keep `REVENUECAT_PURCHASES_ENABLED=false` during setup.
- After explicit production approval, publish both endpoints:
  `supabase functions deploy revenuecat-webhook credits --project-ref oiemotutqshdohmfhtdw --import-map supabase/functions/deno.json`.
- Enable `REVENUECAT_PURCHASES_ENABLED=true` only after the migration, webhook
  authentication, production delivery, and store readiness are verified.
  Sandbox events are acknowledged without crediting the production ledger.

## Review-save schema release

The review client requires `public.save_review(jsonb,jsonb)`. Apply the reviewed
database migrations before merging the frontend change (main auto-deploys).

- Preview pending production migrations without applying them:
  `supabase db push --linked --project-ref oiemotutqshdohmfhtdw --dry-run`.
- With explicit production migration approval:
  `supabase db push --linked --project-ref oiemotutqshdohmfhtdw --yes`.
- Verify applied versions:
  `supabase migration list --project-ref oiemotutqshdohmfhtdw`.

## Editable review examples and mnemonic generation release

`save_card_example(uuid,text,text)` and the `card_media_cleanup` queue are required
by the manual review editor. Validate their migrations using the PGlite tests in `packages/core`; do not apply
production schema as an implementation check. Apply the approved migration
before merging the frontend because main automatically publishes the web app.

- Regenerate shared Edge sources: `bash scripts/vendor-edge.sh`.
- Check both generation entry points:
  `deno check --config supabase/functions/deno.json supabase/functions/generate-mnemonic/index.ts supabase/functions/bulk-worker/index.ts`.
- After explicit production release approval, apply the migration with the
  production migration command above (including the manual-media cleanup
  migration), then publish both functions:
  `supabase functions deploy generate-mnemonic bulk-worker --project-ref oiemotutqshdohmfhtdw --import-map supabase/functions/deno.json`.
- After review and checks clear, merge the frontend. Smoke-test one generated
  sentence, image and recording, then manual sentence, translation and media
  edits. Confirm obsolete stored objects are deleted and failed cleanup remains
  queued for retry. Existing examples and images are preserved until edited or regenerated.

## Recorded class connector

- Extension build: `pnpm --filter @schwanki/extension build`.
- Load `apps/extension/dist` unpacked in Chrome 116 or newer. Production origins
  are supplied by VITE_WEB_ORIGIN and VITE_API_ORIGIN; default localhost is for
  development only. Never ship a wildcard host permission.
- Open the microphone preflight page from the extension before Record. Capture
  permission requires a visible extension page; offscreen documents cannot ask.
- Use the local test-class page and spike checklist in docs/class-recording-spike.md
  for browser capture, playback, pause, interruption and durable recovery checks.
- SQL integration checks require a local Supabase database with migrations applied;
  do not apply migrations to production as part of implementation validation.
- Never merge, deploy a worker, publish an extension, or apply production schema
  without explicit approval. Commit and push validated work to a codex/ branch.

## Tooling verified during the capture spike

The shell's global pnpm is 8.4.0. Use `corepack pnpm` to honor the checked-in
packageManager pin (9.15.0). For RTK compatibility, run package scripts from the
package directory: RTK's pnpm filter adapter can drop --filter for typecheck.
For example, from packages/core run `rtk corepack pnpm typecheck`, or from the
root run `rtk corepack pnpm test` and `rtk corepack pnpm typecheck`.

The extension's local capture fixture is available at benchmark.html when running
`corepack pnpm exec vite --host 127.0.0.1 --port 5182` from apps/extension. Do not
edit a loaded recorder module during a long run: Vite's live reload would interrupt
capture. Actual tabCapture acceptance checks require loading the extension itself.

SQL contract tests in packages/core use PGlite and the real migrations with a
minimal auth fixture. They test PostgreSQL constraints/RLS/rollback, but PGlite's
single writer does not certify production multi-connection concurrency. Run those
checks in local Supabase before release. Do not apply schema to the remote project
as an implementation check.

Transcription comparison (explicit local test samples named zh-en.wav and th-en.wav):
`python3 scripts/class-recording-stt-spike.py --audio-dir /tmp/schwanki-stt-spike --env-file .env`.
Requires an ElevenLabs key with speech_to_text permission. Four model requests
are made; failures stop acceptance without falling back to a different key.
Transcript output stays in the supplied directory. Keep consented class samples
outside the repository. Never commit .env or provider credentials.

Generated browser audio can be delivered to a loopback-only artifact receiver:
`python3 scripts/class-recording-audio-receiver.py` binds 127.0.0.1:5183 and writes
only UUID/channel/part WebM files beneath /tmp/schwanki-browser-audio. Open
http://127.0.0.1:5182/export.html and use Save completed test audio to local receiver.
The receiver requires the benchmark origin, rejects oversized/invalid paths and
returns bytes/checksum. This test fixture is not the remote upload/control API.

For uninterrupted capture testing, prefer the immutable spike build:
from apps/extension run `corepack pnpm build:spike`, then from the repo root run
`python3 -m http.server 5182 --bind 127.0.0.1 --directory apps/extension/spike-dist`.
Keep the benchmark tab open throughout the run. Rebuilding does not itself
reload a static page. The test includes synthetic tones through the actual
playback route; stop the fixture before finishing the session.

For actual extension tab/microphone capture, run `node scripts/serve-class-spike.mjs`
from this checkout. The fixture binds only 127.0.0.1:4179, plays tutor test tones,
and never accesses the microphone. Close the microphone-preflight tab, return to
the tone tab, and invoke Schwanki's toolbar button there before pressing Record.
Keep the loaded extension build unchanged until Stop and export have completed.

For the local session handoff, set `VITE_EXTENSION_IDS` in `apps/web/.env` to the
installed extension ID, preserving any other allowed IDs. Restart the web dev
server after changing this build-time variable. The example environment file
documents this setting; it must not be replaced with a wildcard.

Completed/interrupted captures can export their recording manifest alongside
the audio parts. Manifest export verifies each fragment checksum and byte count,
then includes assembled-part checksums and pause gaps without audio blobs or
browser tab IDs. Keep both the JSON manifest and WebM parts when checking recovery.

A clean snapshot without gitignored development environment files needs dummy
public client configuration for the web unit tests (no real key is required):
`VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=schwanki-test-anon-key corepack pnpm test`.
The staged snapshot was checked with these values; private environment files were
not copied into the verification directory or committed.
