# Schwanki Class Recording Implementation Plan

Date: 2026-10-04
Status: proposed; no implementation tasks completed
Spec: `../specs/2026-10-04-class-recording-design.md`

Goal: a learner explicitly records a browser class, receives evidence-backed notes and learning items, and approves class-scoped flashcards through Schwanki's existing review loop.

## Constraints and prerequisites

- Preserve in-progress listening/source changes. Reuse shared entities when implemented; do not create a second extension, auth handoff, batch model, or provider-key system.
- The inspected checkout does not contain `apps/extension`. The Preply extension spec is a design dependency, not evidence of a working extension. This connector can establish the shared extension shell first, without implementing teacher discovery/chat injection.
- `RUNBOOK.md` is absent at the repository root. Before running implementation build/test/submit commands, establish a repository runbook from checked-in scripts and verified existing project conventions. Do not guess commands or copy another project's runbook. Current `package.json` specifies pnpm 9.15.0 and workspace test/typecheck scripts.
- Prefix eligible shell status/build/test commands with the Headroom RTK binary specified in AGENTS instructions. Read code to edit and run `git diff --check` without RTK.
- Use graph tools for code discovery. Modify package sources, then regenerate Edge Function vendors through `scripts/vendor-edge.sh`; do not hand-edit generated files.
- Determine the next free migration number at implementation time. The separate listening plan proposes `0010`.
- No production deployment or main-branch merge is included. Commit/push completed validated work to a feature branch.

## Task 1 — Browser capture and transcription feasibility

Proposed files: `apps/extension/manifest.json`, `apps/extension/src/recording/*`, `apps/extension/src/offscreen/*`, `docs/class-recording-spike.md`.

- [ ] Read current primary Chrome API references listed in the spec; record the supported Chrome version, capture constraints, and microphone-permission flow.
- [ ] Establish the MV3 TypeScript extension shell if the chat connector has not already done so. Provide configured development and production web-app origins; limit host access to those and the backend.
- [ ] Implement a Record action that obtains tab capture before any network-dependent action, and an offscreen document owning the tab/mic streams.
- [ ] Verify tutor playback remains audible and both channel meters respond. Test headphones and speakers, panel closure, service-worker suspension, track loss, and classroom-tab closure.
- [ ] Record an hour of two-channel synthetic/test-class audio. Measure bitrate, emitted MIME/container format, memory, local bytes, upload bytes, and final decode. Set measured duration and byte limits.
- [ ] Compare transcription candidates on consented/anonymized Chinese/English and Thai/English samples, with teaching, grammar, corrections, and code-switching. Record timestamp quality, error examples, usage, retention terms, and retry behavior.
- [ ] Choose a provider and media-capable worker runtime. Prove remux/segmentation fits runtime limits; record what cannot run in an Edge Function.

Deliverable: a working local capture spike and a documented provider/runtime decision. Do not promise store support or a flat class price before this gate passes.

## Task 2 — Shared contracts, schema, and transactional class approval

Proposed files: next migration(s), `packages/core/src/types.ts`, `packages/core/src/api.ts`, new class contract/API tests, `apps/web/src/lib/groupCandidates.ts` and tests.

- [ ] Add `class_recording` to the source union and database constraint.
- [ ] Create recording/chunk manifests, versioned transcripts/segments, note revisions, learning items, and validated evidence relations as specified. Add owner RLS and same-owner parent validation.
- [ ] Integrate shared `batches` with a unique recording identity and `batch_cards`. If the listening schema already exists, migrate/backfill memberships and adapt its queries; otherwise establish it once for both features.
- [ ] Add nullable recording/item references to candidates and `kind` defaults to candidates/cards. Update card uniqueness to include kind; existing vocabulary data remains valid.
- [ ] Implement a database transaction/RPC for class-candidate approval: validate owner, create/reuse card, initialize missing state, resolve candidate, insert membership and evidence. Return `{cardId, created, batchId}`. Mark duplicates approved with their existing-card association.
- [ ] Extend grouping to prefer recording/batch identity, preserving source/day fallback for legacy sources. Use class time and user-facing timezone for labels.
- [ ] Test repeated words, concurrent approval, mixed card kinds with the same front, two same-day classes, foreign-user references, and rollback on state/membership failure.

Deliverable: a recorded class can have a distinct practice set even when all its words already exist in the deck.

## Task 3 — Authentication, durable recording, and upload recovery

Proposed files: shared extension background/auth handoff, `apps/extension/src/recording/{controller,outbox,manifest}.ts`, IndexedDB storage, offscreen recorder, panel UI; `apps/web/src/pages/ExtensionAuth.tsx` if absent.

- [ ] Implement/reuse the web-app session handoff with origin and extension-ID validation. Keep sessions in trusted extension contexts; never expose them to classroom content scripts or store provider keys in the extension.
- [ ] Build the tutor/language setup, consent acknowledgement, microphone preflight, processing quote, and explicit Record button.
- [ ] Implement one-active-recording control and a state machine for pause/resume/stop/input loss. Clean up tracks and audio contexts on every terminal path.
- [ ] Persist fragments before uploading; sequence per channel/media part and checksum. Store timing gaps explicitly. Respect configured local storage and session limits.
- [ ] Add upload acknowledgements, retry/backoff, auth refresh, and UI showing locally saved vs remotely saved duration.
- [ ] Recover an interrupted manifest after restart, allowing saved-portion processing, explicit new-part capture, or deletion.
- [ ] Test service-worker restart separately from browser restart; test expired auth, failed upload, corrupt checksum, duplicate fragment, storage limit, and panel closure. Run real browser checks for media APIs; mocks alone cannot certify capture.

Deliverable: completed portions survive interruption without claiming an uninterrupted class was recorded.

## Task 4 — Control API, private storage, jobs, and retention

Proposed files: `supabase/functions/start-class-recording`, `class-recording-upload`, `finalize-class-recording`, `retry-class-processing`, `delete-class-recording`; shared guards; private storage policies; worker claim RPCs and dispatch updates.

- [ ] Add the private audio bucket with owner-scoped recording/channel/part paths and short-lived upload/read authorization.
- [ ] Validate source ownership, recording ownership, MIME/container metadata, byte/duration ceilings, sequence uniqueness, and quote limits. Derive storage keys server-side.
- [ ] Make creation and finalization idempotent. Verify every expected fragment before enqueuing transcription; missing fragments yield a recoverable upload state.
- [ ] Implement a leased durable queue with expiry recovery and stage/version idempotency. Filter claims so the existing parse-worker cannot consume recording payloads.
- [ ] Implement cancellation/tombstones that workers check before publishing. Add local/remote deletion coordination and retention cleanup with retry.
- [ ] Test cross-user access at control API and storage levels, duplicate finalization, interrupted manifest acceptance only when explicit, abandoned leases, and deletion races.

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
- [ ] Commit and push the validated feature branch; report outstanding manual gates. Request approval only for production deployment, store publication, or merge to main.

Definition of done: all ten acceptance gates in the spec have evidence, including real Chrome capture and multilingual output review. Passing mocked extension tests alone is insufficient.
