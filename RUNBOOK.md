# Schwanki development runbook

Commands below come from the checked-in workspace scripts and Edge import map.
Use pnpm 9.15.0 (packageManager in package.json). Prefix builds, tests and status
commands with the Headroom RTK binary from the session instructions. Read source
and run git diff --check directly.

## Workspace

- Install workspace dependencies: `pnpm install`.
- Tests: `pnpm test` (runs each package's test script).
- Type checking: `pnpm typecheck` (runs each package's typecheck script).
- Web development: `pnpm dev`.
- Web build: `pnpm --filter @schwanki/web build`.
- Web lint: `pnpm --filter @schwanki/web lint`.
- Edge source check: `deno check --config supabase/functions/deno.json supabase/functions/parse-worker/index.ts`.
- Vendor package source changes: `bash scripts/vendor-edge.sh`; generated files
  must accompany their source changes. `bash scripts/check-vendor.sh` checks
  committed vendor drift; it regenerates first.
- Whitespace validation: `git diff --check`.

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
