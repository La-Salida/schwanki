# Schwanki Class Recording Implementation Plan

Date: 2026-10-04
Status: in progress (2026-10-05); Task 1 local spike built, real capture/provider gates open; Task 2 implemented and tested locally
Spec: `../specs/2026-10-04-class-recording-design.md`

Goal: a learner explicitly records a browser class, receives evidence-backed notes and learning items, and approves class-scoped flashcards through Schwanki's existing review loop.

## Constraints and prerequisites

- Preserve in-progress listening/source changes. Reuse shared entities when implemented; do not create a second extension, auth handoff, batch model, or provider-key system.
- The inspected checkout does not contain `apps/extension`. The Preply extension spec is a design dependency, not evidence of a working extension. This connector can establish the shared extension shell first, without implementing teacher discovery/chat injection.
- `RUNBOOK.md` is absent at the repository root. Before running implementation build/test/submit commands, establish a repository runbook from checked-in scripts and verified existing project conventions. Do not guess commands or copy another project's runbook. Current `package.json` specifies pnpm 9.15.0 and workspace test/typecheck scripts.
- Prefix eligible shell status/build/test commands with the Headroom RTK binary specified in AGENTS instructions. Read code to edit and run `git diff --check` without RTK.
- Use graph tools for code discovery. Modify package sources, then regenerate Edge Function vendors through `scripts/vendor-edge.sh`; do not hand-edit generated files.
- Determine the next free migration number at implementation time. The uncommitted local listening plan proposes `0010`; neither that draft nor its migration number is a required dependency of this plan.
- No production deployment or main-branch merge is included. Commit/push completed validated work to a feature branch.

## Task 1 — Browser capture and transcription feasibility

Proposed files: `apps/extension/manifest.json`, `apps/extension/src/recording/*`, `apps/extension/src/offscreen/*`, `docs/class-recording-spike.md`.

- [x] Read current primary Chrome API references listed in the spec; record minimum Chrome version, capture constraints, and microphone-permission flow. Tested support remains unverified; see `../../class-recording-spike.md`.
- [ ] Establish the MV3 TypeScript extension shell if the chat connector has not already done so. Provide configured development and production web-app origins; limit host access to those and the backend.
- [ ] Implement a Record action that obtains tab capture before any network-dependent action, and an offscreen document owning the tab/mic streams.
- [ ] Verify tutor playback remains audible and both channel meters respond. Test headphones and speakers, panel closure, service-worker suspension, track loss, and classroom-tab closure.
- [ ] Record an hour of two-channel synthetic/test-class audio. Measure bitrate, emitted MIME/container format, memory, local bytes, upload bytes, and final decode. Set measured duration and byte limits.
- [ ] Compare transcription candidates on consented/anonymized Chinese/English and Thai/English samples, with teaching, grammar, corrections, and code-switching. Record timestamp quality, error examples, usage, retention terms, and retry behavior.
- [ ] Choose a provider and media-capable worker runtime. Prove remux/segmentation fits runtime limits; record what cannot run in an Edge Function.

Deliverable: a working local capture spike and a documented provider/runtime decision. Do not promise store support or a flat class price before this gate passes.

## Task 2 — Shared contracts, schema, and transactional class approval

Proposed files: next migration(s), `packages/core/src/types.ts`, `packages/core/src/api.ts`, new class contract/API tests, `apps/web/src/lib/groupCandidates.ts` and tests.

- [x] Add `class_recording` to the source union and database constraint.
- [x] Create recording/chunk manifests, versioned transcripts/segments, note revisions, learning items, and validated evidence relations as specified. Add owner RLS and same-owner parent validation.
- [x] Integrate shared `batches` with a unique recording identity and `batch_cards`. Listening is absent on origin/main; shared membership is established once.
- [x] Add nullable recording/item references to candidates and `kind` defaults to candidates/cards. Update card uniqueness to include kind; existing vocabulary data remains valid.
- [x] Implement a database transaction/RPC for class-candidate approval: validate owner, create/reuse card, initialize missing state, resolve candidate, insert membership and evidence. Return `{cardId, created, batchId}`. Mark duplicates approved with their existing-card association.
- [x] Extend grouping to prefer recording/batch identity, preserving source/day fallback for legacy sources. Use class time and user-facing timezone for labels.
- [x] Test repeated words, concurrent approval, mixed card kinds with the same front, two same-day classes, foreign-user references, and rollback on state/membership failure. PGlite plus native PostgreSQL 17; complete Supabase migration-chain/Storage validation remains a release gate.

Deliverable: a recorded class can have a distinct practice set even when all its words already exist in the deck.

## Task 3 — Authentication, durable recording, and upload recovery

Proposed files: shared extension background/auth handoff, `apps/extension/src/recording/{controller,outbox,manifest}.ts`, IndexedDB storage, offscreen recorder, panel UI; `apps/web/src/pages/ExtensionAuth.tsx` if absent.

- [ ] Implement/reuse the web-app session handoff with origin and extension-ID validation. Keep sessions in trusted extension contexts; never expose them to classroom content scripts or store provider keys in the extension.
- [ ] Build the tutor/language setup, consent acknowledgement, microphone preflight, prepared processing quote/reservation, and explicit Record button. Show a live microphone meter during preflight; enable the class-audio meter only after Record authorizes tab capture. Refresh expired quotes before enabling the button.
- [ ] Implement one-active-recording control and a state machine for pause/resume/stop/input loss. Clean up tracks and audio contexts on every terminal path.
- [ ] Persist fragments before uploading; sequence per channel/media part and checksum. Store timing gaps explicitly. Respect configured local storage and session limits.
- [ ] Acknowledge the prepared session as started only after local stream acquisition; network delay must not invalidate the browser gesture. Preserve bounded local chunks while retrying a temporary acknowledgement failure, and stop with saved-portion recovery if the session is rejected/expired.
- [ ] Add upload acknowledgements, retry/backoff, auth refresh, and UI showing locally saved vs remotely saved duration.
- [ ] Recover an interrupted manifest after restart, allowing saved-portion processing, explicit new-part capture, or deletion.
- [ ] Test service-worker restart separately from browser restart; test expired auth, failed upload, corrupt checksum, duplicate fragment, storage limit, and panel closure. Run real browser checks for media APIs; mocks alone cannot certify capture.

Deliverable: completed portions survive interruption without claiming an uninterrupted class was recorded.

## Task 4 — Control API, private storage, jobs, and retention

Proposed files: `supabase/functions/prepare-class-recording`, `start-class-recording`, `class-recording-upload`, `finalize-class-recording`, `retry-class-processing`, `delete-class-recording`; shared guards; private storage policies; worker claim RPCs and dispatch updates.

- [ ] Add the private audio bucket with owner-scoped recording/channel/part paths and short-lived upload/read authorization.
- [ ] Validate source ownership, recording ownership, MIME/container metadata, byte/duration ceilings, sequence uniqueness, and quote limits. Derive storage keys server-side.
- [ ] Make preparation, start acknowledgement, and finalization idempotent. Expire abandoned prepared sessions and release their reservations. Finalization requires an accepted session; verify every expected fragment before enqueuing transcription, and make missing fragments a recoverable upload state.
- [ ] Implement a leased durable queue with expiry recovery and stage/version idempotency. Filter claims so the existing parse-worker cannot consume recording payloads.
- [ ] Implement cancellation/tombstones that workers check before publishing. Add local/remote deletion coordination and retention cleanup with retry.
- [ ] Test cross-user access at control API and storage levels, expired/cancelled prepared sessions, delayed or rejected start acknowledgement, duplicate finalization, interrupted manifest acceptance only when explicit, abandoned leases, and deletion races.

Deliverable: untrusted clients cannot enqueue another user's audio or publish output for a deleted class.

## Task 5 — Transcription and evidence-aware lesson extraction

Proposed files: `packages/classes/src/{types,transcription,extract,validate,merge}.ts`, versioned prompt(s), fixtures/tests; media worker at the runtime chosen in Task 1; `supabase/functions/class-notes-worker` or equivalent durable worker.

- [ ] Define a provider-neutral timestamped transcript contract. Preserve channel/time alignment, unknown speakers, uncertainty, and code-switching.
- [ ] Assemble/remux validated media parts. Segment to provider limits; reconcile overlaps deterministically and preserve pause/new-part offsets.
- [ ] Persist transcript revisions before extraction. Empty audio/transcript and malformed outputs must produce actionable failures.
- [ ] Extract windowed teaching items with evidence, then merge into a coherent notes result. Keep homework/next steps empty when they were not mentioned.
- [ ] Validate every evidence ID, quote, target-language item, kind, and schema before saving. Exclude casual filler, unsupported speaker attributions, and hallucinated corrections.
- [ ] Create lesson-linked pending candidates in an idempotent transaction; route uncertain text to review. Keep generated translation/reading/explanation fields labeled.
- [ ] Support failed-stage retry and transcript edits with new derived revisions. Protect approved cards and user-edited pending candidates from replacement.
- [ ] Add fixtures for zh/en, th/en, phrase teaching, grammar practice, explicit corrections, uncertain speech, multiple remote speakers, silent tracks, transcript prompt injection, and repeated extraction.

Deliverable: notes and candidate cards are two views of the same persisted evidence-backed lesson result.

## Task 6 — PWA class page, triage, and practice integration

Proposed files: `apps/web/src/pages/Classes.tsx`, `ClassDetail.tsx`, Sources connector UI, App routes/nav, Triage page, CandidateRow, class evidence viewer, and focused component tests.

- [ ] Add Recorded classes to Sources, with extension setup and per-tutor language defaults.
- [ ] Add a classes list and class page showing upload/processing/error/retry states, completeness warnings, notes, learning categories, and timestamped transcript.
- [ ] Let learners edit speaker labels and transcript text; show derived results as stale until explicitly regenerated.
- [ ] Scope triage by recording ID and support kind filters, editable suggestions, original vs generated content, and evidence links.
- [ ] Show existing-card matches and link those cards into the class practice set after approval without resetting FSRS.
- [ ] Add **Practice this class** using batch membership. Connect listening generation only when the listening feature is available; its target query must use `batch_cards`.
- [ ] Add class deletion choices and retention deadline display. Expired audio removes playback controls while timestamp links still open transcript passages.
- [ ] Test two same-day classes, no extracted items, unsupported/uncertain speech, an all-duplicate class, failed stages, user edits across regeneration, and shared-card deletion.

Deliverable: the full class is usable as a source even if it adds no new vocabulary card.

## Task 7 — Pricing, BYOK, release validation

Proposed files: shared key-resolution/capability modules, credit reservation/settlement RPCs, class processing configuration, Settings capability UI, runbook and release checklist.

- [ ] Price recording-minute and text-stage usage from Task 1 measurements, with a documented margin target. Keep recording free of AI charges; quote processing before capture.
- [ ] Add atomic credit reservation/settlement keyed by processing run. Handle cancellation, failed stages, reservation expiry, and successful publication without duplicate debit.
- [ ] Extend provider-key support only after selecting providers; capability coverage requires both transcription and extraction. User-key failures cannot silently debit platform credits.
- [ ] Test concurrent finalize/retry, exhausted balance, expired reservation, BYOK stage coverage, terminal failure, and deletion during a paid run.
- [ ] Run the appropriate checks documented in RUNBOOK. Regenerate vendors if package sources or the vendor package list changed.
- [ ] Dogfood a consented real class: capture both speakers → stop → notes → evidence links → edited/approved vocabulary + grammar + correction cards → class review.
- [ ] Repeat with network loss and with a second same-day class containing repeated words. Verify retained card histories and membership in both practice sets.
- [ ] Confirm audio retention cleanup, provider data handling, extension permissions/disclosures, and measured worker throughput before seeking production/store approval.
- [x] Commit and push the validated foundation to `codex/recorded-class-connector`; implementation commit `6ea31c2`. Outstanding manual gates are recorded below. No production deployment, store publication, or main merge.

Definition of done: all ten acceptance gates in the spec have evidence, including real Chrome capture and multilingual output review. Passing mocked extension tests alone is insufficient.

## Implementation checkpoint — 2026-10-05

- [x] Establish verified root RUNBOOK, preserve original local drafts, and work from origin/main in an isolated codex/ worktree.
- [x] Build the local MV3/offscreen capture spike, durable chunk store, explicit recovery, export verifier and private provider-comparison harness.
- [x] Run a native hour-long synthetic media benchmark: all 24 two-channel parts decode. This is worker-tooling evidence, not real Chrome capture.
- [x] Complete Task 2's provider-independent schema/API/grouping foundation with native concurrent approval and rollback tests; synchronize Edge vendors.
- [ ] Complete Task 1's real Chrome capture/hour/interruption and multilingual provider selection gates. Browser control cannot load unpacked extensions; manual sideload is required. Consented audio and an OpenAI comparison credential are missing; an unvalidated ElevenLabs key exists in the original local .env.
- [ ] Resume Tasks 3–7 after the Task 1 gates. The local spike does not implement authentication, production quotes, uploads, extraction, class pages, or billing. Their checkboxes remain open.

Detailed evidence, exact sideload instructions, runtime limitations and provider
protocol: `../../class-recording-spike.md`.
