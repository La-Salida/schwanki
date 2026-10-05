# Recorded-class spike — 2026-10-05

Status: implemented local spike and independent schema foundation; **real Chrome
capture and multilingual provider gates are open**. No production processing,
billing, deployment, publication or store-support claim.

## Repository readiness

Started from refreshed `origin/main` at `48be675` on
`codex/recorded-class-connector` in `/private/tmp/schwanki-recorded-class`.
Original checkout and its modified product spec, `.zcode/`, and listening drafts
were preserved. At that commit there was no extension, persisted batch model,
or listening pipeline. The graph was indexed separately for this worktree.
`RUNBOOK.md` was established from actual workspace scripts before implementation
checks. Migration `0010_recorded_classes.sql` was the next committed number.

## Chrome/API investigation

Primary references checked 2026-10-05 (documentation does not replace real tests):

| Primary reference | Consequence for this spike |
| --- | --- |
| https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture | Service-worker stream IDs consumed by offscreen documents require Chrome 116+. |
| https://developer.chrome.com/docs/extensions/reference/api/tabCapture | Capture follows extension invocation; stream IDs are single-use and expire in seconds. Omit consumerTabId for offscreen consumption. Tab capture suppresses playback; route tab audio through an AudioContext destination. |
| https://developer.chrome.com/docs/extensions/reference/api/offscreen | Use USER_MEDIA, static bundled HTML, and runtime messaging. Offscreen documents support only chrome.runtime among extension APIs; use native IndexedDB for audio. |
| https://developer.chrome.com/docs/extensions/reference/api/sidePanel | Open the panel from the toolbar gesture; sidePanel.open requires Chrome 116+. Closing the panel must not own stream lifetime. |
| https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle | Workers may shut down when idle; do not own recorders or volatile manifests in them. |
| https://www.w3.org/TR/mediastream-recording/ | Timeslice blobs are not independently playable. Assemble fragments from one completed MediaRecorder instance into one media part. Bitrate and timeslice are hints, not hard guarantees. |

Declared minimum Chrome: 116; **tested support: none yet**. No content scripts,
page scraping, teacher discovery, chat interception, provider keys or broad host
permissions. This is the initial shared extension shell, not a second connector.
Web-app session handoff and backend quotes belong to Task 3 and remain gated.

Preparation creates a visibly local, zero-cost test session; it does not pretend
to be a production quote. Microphone permission is obtained on a visible extension
page; preflight meters are owned by the offscreen document and save no audio.
Record consumes the selected classroom stream ID immediately, acquires tab and
microphone streams before any network acknowledgement, and records them separately.
Only tab audio is routed to speakers, avoiding direct microphone feedback.

The offscreen owner serializes capture changes and fragment persistence. Each
fragment has SHA-256, channel/part/sequence, MIME, bytes and approximate timeline
offsets. Durable fragment and byte-counter writes are one strict IndexedDB
transaction. No fragment is removed to make space. Pause and five-minute part
rotation close containers and persist explicit gaps. Track loss saves the
completed portion. Browser restart marks it interrupted and requires an explicit
new capture action to resume. Worker restart leaves the existing offscreen owner
intact. These paths are implemented but still need real-browser acceptance.

## Native media measurement (not Chrome capture evidence)

Reproduce with `node scripts/benchmark-class-media.mjs`; aggregate output is in
`spike-evidence/native-media-benchmark.json`. It generates two native sine-wave
channels, each an hour long, split into 24 independent five-minute WebM/Opus parts.
The arbitrary byte fragments exercise ordering/checksums; they are not browser
MediaRecorder timeslices. All parts were remuxed and fully decoded by ffmpeg.

- 66,051,288 encoded bytes; effective 73,390 bits/sec/channel despite a 48k target.
- 1,440 synthetic byte fragments; all 24 parts decode.
- About 30.2 seconds including encoding; about 12.5 seconds for verification.
- Node's full JSON/base64 export verifier reached 687,008 KiB peak RSS.
  **Browser and ffmpeg child memory were not measured.**

The measured bitrate disproves using 48k as a strict byte ceiling. Local capture
now uses provisional 60-minute/96-MiB ceilings, a 4-MiB reserve, storage-quota
preflight, and backpressure stops. They are safety defaults, not production limits.
The explicit post-recording JSON export loads audio into memory; it is a spike
diagnostic and must be replaced by a streaming export/worker input path before
release. Do not deploy this JSON verifier as the hour-long production worker.

Runtime candidate: a native Node/ffmpeg process with private disk and per-part
streaming. It has actual decode evidence on this host. Production worker/runtime
selection remains open pending browser containers, crash recovery, scratch/RSS
measurements, and provider comparison. Supabase Edge Functions cannot be assumed
to have native ffmpeg; no audio worker or deployment was created there.

## Real Chrome acceptance protocol

The connected browser control service blocks `chrome://extensions/` and supports
only http/https navigation. It cannot sideload or control this extension's internal
pages. Do not bypass that policy with another browser-control surface.

1. Build using the extension command in `RUNBOOK.md`. In Chrome manually open
   `chrome://extensions`, enable Developer mode and Load unpacked from
   `/private/tmp/schwanki-recorded-class/apps/extension/dist`.
2. Run the loopback fixture server from the runbook and open
   `http://127.0.0.1:4179/`. It was opened successfully through real Chrome on
   2026-10-05; this proves only fixture availability, not capture.
3. Play tutor tones. Click the Schwanki toolbar action on that tab. Grant mic
   permission on the visible check page, return to the classroom, check the mic,
   acknowledge recording and prepare. Confirm Record is disabled until preparation.
4. Wear headphones; speak into the real mic. Record at least 30 seconds, check both
   live meters and audibly confirm tutor playback. Close/reopen the panel during
   capture. Export after Stop; verify the exported audio with the runbook command.
5. Separately stop the extension service worker with panel closed, then reopen.
   Capture should persist with the same offscreen owner. Record Chrome version,
   OS, microphone, headphones/echo result, duration and peak pending bytes.
6. Pause/resume, disconnect the mic, and close the classroom tab in separate runs.
   Verify explicit gaps/states and decode every saved part. Restart Chrome while
   recording; export the saved portion, then explicitly prepare recovery and Record
   a new part. No resumed stream or uninterrupted transcript may be claimed.
7. Record an actual hour in Chrome with both channels. Use Chrome Task Manager
   for recording-document RSS. Export and compare local bytes to decoded media.
   Record storage usage, negotiated MIME, final decoded durations and missing parts.
8. Repeat with network disconnected. This local-only spike has no uploads;
   authenticated retry/expired auth/duplicate finalize are Task 3–4 gates, not passed.

No audible playback, microphone bleed, panel-closure, suspension, tab-loss,
restart or hour-long browser result is asserted in this report.

## Provider comparison protocol and blockers

The command environment has no transcription keys loaded. A targeted, value-redacted
check found ELEVENLABS_API_KEY configured in the original checkout's `.env`; it has
not been validated or copied into this worktree. OPENAI_API_KEY and DEEPGRAM_API_KEY
are absent from the command environment and the repository's expected local env
files. No audio fixtures exist in the committed samples/docs. No user keys were
read from production or browser session stores. No provider request, billable
transcription, or provider-quality comparison has been made.

Primary shortlist references checked 2026-10-05:

| Candidate | Why compare | Limits and unresolved release questions |
| --- | --- | --- |
| OpenAI whisper-1 | Documented word/segment timestamps; transcriptions endpoint preserves source speech instead of the English translations endpoint. | 25-MB guide limit; comparison harness caps WAVs at 20 MiB and five minutes. Code-switching quality, actual bill and account-specific retention need verification. |
| ElevenLabs scribe_v2 | Word timestamps/opaque diarization IDs; documented Mandarin/Thai support. | Chinese/Thai accuracy claims are not classroom results. Zero-retention enable_logging=false is enterprise-only; standard retention must be explicitly acknowledged for any sample upload. |

References:
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/your-data
- https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- https://elevenlabs.io/docs/api-reference/speech-to-text/convert

For the existing ElevenLabs local key, Node can load the original env file using
`--env-file=/Users/yjkim/Developer/Schwanki/.env` when executing the private harness;
do not source or print it, copy it to the extension, or commit it.

Use `scripts/benchmark-class-transcription.mjs` only with consented/anonymized
five-minute WAV samples and private output directories. A private sample descriptor:

```json
{ "id": "zh-en-grammar-01", "consented": true, "languages": "zh-en",
  "channel": "tab", "offsetMs": 0, "file": "tab-0.wav" }
```

Run each candidate against both language pairs, both channels and at least one
grammar explanation, correction, unclear name and code-switching passage.
Have a fluent reviewer mark original target text, missing/translated speech,
timestamp error and speaker mistakes. Keep readings out of the transcription.
Log actual provider usage/bill, latency, retention eligibility and 401/429/timeout
behavior; distinguish transcription log probabilities from extraction confidence.
The harness saves private timestamped output and refuses accidental replays using
an exclusive attempt receipt. No automatic billable retries or key fallbacks.
Provider selection and class pricing remain **undecided**.

## Independent Task 2 foundation

`0010_recorded_classes.sql` adds owner-scoped manifests, transcript/note revisions,
learning items with distinct evidence/generated JSON fields and exact quoted
segment evidence, card kinds, one batch per class and many-to-many membership.
It adds `approve_class_candidate` as a single transaction: owner/evidence/current
revision checks, reviewed edits, normalized kind-aware dedup, initialization only
for missing FSRS state, candidate approval, class membership and evidence. Existing
cards retain their scheduling state. Clients cannot directly approve class rows or
publish processing output. Tombstones and processing generations reject deleted or
superseded transcript publication. UI grouping prefers class identity over dates.

The PostgreSQL tests use PGlite and native PostgreSQL 17 in an isolated Docker
container, actual baseline candidate FK changes and the whole new migration.
They verify legacy vocabulary preservation, ownership, RLS, immutable evidence,
edits, replay, repeated-word history preservation, rollback and tombstones. Eight
concurrent approvals from independent PostgreSQL sessions produce one card/state
and two class memberships. Tests **do not certify** the complete Supabase migration
chain or private Storage RLS; those remain release blockers. Schema/API changes
must ship together with future control APIs; this migration is not deployed.

## Validation ledger

- Workspace: 191 tests pass (7 extension, 24 core, 76 mnemonic, 29 parsing, 55 web).
- Workspace TypeScript checks and web/PWA build pass; extension build passes.
- Edge Functions: 17 tests pass using the checked-in Deno import map.
- `pnpm test:classes`: 11 tests/subtests pass in PGlite and native ffmpeg.
- Native PostgreSQL schema/ownership/concurrent approval: 10 tests/subtests pass.
- Native hour-long media measurement: 24 parts fully decode, no browser claim.
- Real Chrome: fixture loaded; extension sideload/capture acceptance still pending.
- Provider quality, retention eligibility, pricing and production throughput: pending.
