# Schwanki — Recorded Classes as Learning Sources

Date: 2026-10-04
Status: proposed design; implementation and browser validation pending
Companion spec: `2026-09-28-preply-extension-design.md`. Batch-listening integration is described here; its separate `2026-10-04-batch-listening-design.md` document is currently an uncommitted local draft and is not a prerequisite for reviewing or implementing this connector.

## 1. Product outcome

A learner clicks **Record class** in the Schwanki Chrome extension while taking a lesson on Preply or another browser-based classroom. After the class, Schwanki produces lesson notes and extracts the vocabulary, phrases, grammar, examples, and corrections actually covered. The learner reviews suggested cards, then practices that class through the existing spaced-repetition loop and, when implemented, batch listening.

The class is a persistent learning source: notes and cards refer back to the transcript passages they came from. This extends the existing Sheet, Doc, PDF, and chat connectors. The recording capability belongs in the same extension as chat capture, with a separate recording workflow.

Success means **one lesson becomes notes and a practice set**, without the learner copying the conversation into another tool.

## 2. Scope and existing implementation

Implemented building blocks inspected in this checkout:

- `packages/core/src/types.ts`: source, candidate, card, and review contracts; `class_recording` and lesson IDs need to be added.
- `packages/core/src/api.ts`: source management and candidate approval. Approval currently discards deck duplicates; recordings must additionally link the existing card to the new class.
- `packages/parsing/src/orchestrator.ts`: shared candidate extraction and deduplication. Recorded conversations need a purpose-built, evidence-aware extractor rather than treating all speech as a vocabulary list.
- `apps/web/src/lib/groupCandidates.ts`: groups by source and creation day. Two classes on the same day currently share a group.
- `supabase/functions/parse-worker/index.ts`: claims LLM jobs and creates candidates. Its current dispatcher assumes a parse payload; new job types require explicit routing.
- `supabase/migrations/0009_source_files.sql`: private owner-scoped storage and a source-removal precedent.

The earlier Preply extension and batch-listening documents describe planned work. In the inspected checkout, the `apps` directory contains `web`, and the core card contract has no batch ID. Do not assume extension authentication, persisted batches, or listening packs already ship.

First release: manual audio recording in Chrome, both sides of the conversation, asynchronous transcription, lesson notes, evidence-backed extraction, candidate review, and class-scoped flashcards. Start with Preply for dogfooding but use a generic selected-tab capture path. No Preply API or classroom DOM integration is required for recording.

Defer video, automatic start, live coaching, screen-content analysis, automatic homework completion, native apps, and calendar integrations. Tutor chat and shared documents can later enrich the same lesson, but must remain separately attributed.

## 3. Learner flow

### Before the class

1. In Sources, choose **Recorded classes → Connect Chrome extension**. The existing extension design's web-app sign-in handoff is shared with this connector.
2. On the classroom tab, open the extension and choose the tutor/source, target language, and explanation language. Source settings provide defaults; the user may create a tutor label manually.
3. Complete microphone permission and a short input check. The **Your microphone** meter is live during preflight; **Class audio** says “Checked when recording starts” until the explicit Record action authorizes tab capture. Show both live meters once recording starts. Save audio only after the recording action.
4. Show a short reminder to tell the tutor the class will be recorded; require an acknowledgement for this recording. This records the learner's acknowledgement, not proof of the tutor's consent.
5. Prepare the recording session through the backend before enabling **Record class**. Show its processing estimate, maximum authorized charge, and duration/byte limits; reserve platform credits if needed. An expired quote must be refreshed before the button is enabled. Cancelled or abandoned prepared sessions release their reservation.

### During the class

- A persistent extension panel shows **Recording**, elapsed time, both audio meters, and **Pause / Resume / Stop**. The toolbar badge also indicates recording while the panel is closed.
- Recording is explicit and limited to the selected classroom tab and selected microphone. No automatic capture on navigation or page load.
- The learner continues to hear the tutor. Audio playback routing is part of the browser acceptance gate.
- Pause records an explicit gap in the timeline. Resume never fabricates transcript text for that gap.
- Closing the panel must not stop recording. Closing the classroom tab or losing an audio track stops capture with an explanation and preserves completed chunks.
- Silent/missing input produces a visible warning and an input-check action. Do not silently claim both participants were recorded.

### After the class

1. **Stop** preserves the audio locally and completes pending uploads. Distinguish **Saved on this device**, **Uploading**, **Transcribing**, and **Making lesson notes**.
2. The extension links to a class page in the PWA. The user can leave that page; processing continues in the backend.
3. The class page contains:
   - **Notes:** title, topics, what was practiced, tutor explanations, learner corrections, explicit homework, and next-class points actually mentioned.
   - **Vocabulary & phrases:** target text, translation, reading where relevant, and class example.
   - **Grammar:** the rule, its explanation, and examples discussed in class.
   - **Corrections:** what the learner said and the tutor's correction, when the conversation supports that attribution.
   - **Transcript:** timestamped segments, uncertain spans, gaps, and editable speaker labels.
4. **Review class cards** opens the existing triage experience scoped to this lesson, with categories and transcript references. Approve selected cards, edit, or discard. Avoid automatically creating a card for every word spoken.
5. Approved and already-known cards appear in this class's practice set. A future listening pack consumes those cards through the batch-listening integration.

Proposed copy: “Class over. Your notes aren't.”; “12 words, 2 grammar patterns, 3 corrections. Pick what sticks.” Counts come from persisted extraction results.

## 4. What becomes a card

Each extracted item has a kind and at least one transcript segment reference. Extraction favors explicit teaching signals: translations, repeated practice, explanations, learner questions, and tutor corrections. Casual filler and logistics are excluded unless explicitly taught.

| Item | Suggested card | Example |
|---|---|---|
| Vocabulary | Target word → meaning, with reading and class example | `虽然` → although |
| Phrase | Useful phrase → meaning/use in context | A phrase the learner practiced ordering food with |
| Grammar | Application prompt → pattern, explanation, class example | Ask the learner to complete an example using `虽然…但是…` |
| Correction | Original sentence + correction prompt → corrected form and explanation | A tutor-confirmed correction from the lesson |

Grammar and correction cards are application prompts rendered through the current front/back review UI. Dedicated cloze rendering can follow later. Preserve actual teacher wording in evidence; place any generated explanation in a visibly separate field. Pronunciation tips can appear in notes, but an audio-only pipeline must not claim a phonetic diagnosis it cannot substantiate.

Example translations, readings, and explanations supplied by AI are labeled as generated. Unsupported target text, unclear names, and uncertain grammar claims stay flagged for review; no guessed content is silently approved. A transcription uncertainty signal and an LLM's self-reported confidence are not interchangeable.

The transcript is evidence of what was said, not a guarantee that a grammar claim is correct. Surface potentially questionable teaching content for review rather than silently rewriting it.

## 5. Capture and upload architecture

```text
Learner's Record action
  → extension service worker coordinates selected-tab capture
  → offscreen recording document owns tab + microphone streams
  → local IndexedDB chunks + upload manifest
  → private owner-scoped audio storage
  → finalize-class-recording validates a complete manifest
  → durable transcription job
  → timestamped transcript
  → versioned lesson notes + learning items
  → lesson-scoped candidates → triage → FSRS cards
```

Browser implementation target: Manifest V3, `chrome.tabCapture`, an offscreen recording document, `MediaRecorder`, and microphone `getUserMedia`. Confirm current API restrictions and the minimum supported Chrome version against the primary references below and the real browser acceptance test before declaring support.

- The explicit Record action obtains the tab-capture stream identifier while the browser's user gesture is valid. Do not put network calls ahead of that permission-dependent operation. Configuration/auth/preflight happen before the button is enabled.
- The offscreen document owns media streams; the service worker coordinates messages and uploads. Service-worker suspension must not end the recording.
- Capture tab audio and microphone separately, with aligned recording-time offsets. Separate channels help distinguish classroom speech from learner speech; they do not prove who each remote speaker is. Microphone bleed and echo must be tested. Headphones are suggested when bleed is detected.
- Encode at a bounded bitrate; record negotiated codec/MIME type in the manifest. Establish configurable duration, upload-byte, and local-storage limits from measured two-channel recordings. Stop gracefully before a limit, preserving completed data.
- Persist each emitted fragment to IndexedDB before attempting upload. `chrome.storage.local` stores lightweight metadata only. Keep one active recording per browser profile.
- Store `{recordingId, channel, part, sequence, startMs, durationMs, bytes, checksum, mimeType}` for every fragment. Independent parts have their own container headers; a `MediaRecorder` timeslice fragment must not be assumed independently decodable.
- The audio worker validates and remuxes complete ordered parts before transcription, then splits into provider-supported media units with context at boundaries. Reconcile overlap to avoid duplicate transcript text. Preserve time offsets across pauses and parts.
- Upload retries are idempotent by recording/channel/part/sequence and checksum. A conflicting checksum is an error. Refresh expired upload authorization through the authenticated control API; never keep a server secret in the extension.
- Browser restart cannot restore a live stream. Offer **Process saved portion**, **Resume as a new part**, or **Delete** for an interrupted recording. A new part needs another explicit capture action and attaches to the same class.
- When local data exceeds available storage, stop and report the saved duration. Never delete unuploaded audio to make room. Remove local chunks only after server acknowledgement or explicit deletion.

The extension uses its own UI. Recording does not depend on injecting controls into Preply or reading its private network APIs.

## 6. Backend processing and ownership

Control functions require a real user JWT and verify the recording, source, and language belong to that user. Source IDs alone are not authorization. Workers use internal credentials, and cannot be called with public/user tokens.

Proposed API:

- `prepare-class-recording`: before enabling Record, create/reuse the source and a prepared recording using a client-generated idempotency key; return recording ID, limits, expiring quote/reservation, and upload capability. No media is captured by this request.
- `start-class-recording`: after the explicit Record action has acquired the streams locally, mark the prepared recording active. This network acknowledgement must not precede the browser capture operation. If acknowledgement is temporarily unavailable, keep bounded chunks locally and retry; finalization requires an accepted session. A rejected/expired session stops capture and offers saved-portion recovery after a new authorized quote.
- `class-recording-upload`: issue narrowly scoped upload authorization and acknowledge validated chunks.
- `finalize-class-recording`: accept the expected manifest; enqueue exactly one transcription run after upload verification. Repeated requests return the same run.
- `retry-class-processing`: retry the failed stage without re-recording or duplicating output.
- `delete-class-recording`: cancel processing and schedule remote audio/transcript/output cleanup; the extension also clears any local copy.
- `approve-class-candidate`: atomically create or reuse a card, create missing initial FSRS state, set candidate status, and add class membership.

Do not run a 60-minute class through one user-facing Edge Function request. Use durable jobs for remux/transcription and notes/extraction. An audio worker may require a media-capable process outside Supabase Edge Functions; pick and benchmark the runtime in the capture/transcription spike. Worker deployment requires separate production approval.

Transcription provider contract returns timestamped segments, optional speaker labels and uncertainty metadata, and actual usage. Evaluate mixed target-language/English classes, especially Chinese and Thai; do not select a provider on English-only samples. The user chooses the target and explanation languages; transcription must preserve code-switching instead of translating away what was said.

Extraction runs over transcript windows, creates evidence-backed intermediate items, and merges those items into a whole-lesson result. Verify every segment ID and quoted excerpt against the stored transcript. Treat transcript text as untrusted source content, never as instructions to the model or worker. Malformed provider output is a failed/retryable job, not an empty successful class.

One versioned extraction result produces both notes and candidate items, so notes and cards agree. Editing a transcript preserves the prior revision and marks derived results stale. Regeneration creates a new revision; user-edited/approved cards are never overwritten, and pending user-edited suggestions require explicit replacement.

Job claims need leases, expiry recovery, bounded retries, and an idempotency key including recording ID, transcript revision, stage, and model/prompt version. The current parse worker must claim only the job types it can dispatch; otherwise it can accidentally consume recording jobs as text-parsing jobs.

## 7. Data model and class identity

Select the next unused migration number during implementation. The uncommitted local listening plan proposes `0010`; that number is not a committed reservation, and concurrent work may add more migrations.

| Entity | Responsibility |
|---|---|
| `sources.type = class_recording` | Connector/tutor identity with defaults for language and label |
| `class_recordings` | Owner, source, label, target/explanation language, start/end, duration, quote, retention deadline, processing state, failure stage, client idempotency key |
| `class_recording_chunks` | Owner-scoped manifest, checksums, media parts, upload acknowledgements, and offsets; unique recording/channel/part/sequence |
| `class_transcripts` / `class_transcript_segments` | Versioned transcript; ordered immutable segment IDs, times, channel, optional speaker, text, uncertainty |
| `class_note_revisions` | Transcript revision, structured notes/items, prompt/model versions, actual usage, and current result pointer |
| `class_learning_items` | Vocabulary/phrase/grammar/correction, authored vs generated fields, validated evidence, and extraction revision |
| `candidate_cards` additions | Nullable `recording_id`, `learning_item_id`, `kind` default `vocabulary`, and approval linkage |
| `cards` addition | `kind` default `vocabulary`; retain current front/back rendering and FSRS contracts |
| `batches` integration | One batch per recording, independent of source/date. Reuse the listening schema if implemented, otherwise establish the shared contract once |
| `batch_cards` | Many-to-many batch/card membership; a previously learned word can belong to several lessons without resetting its FSRS state |
| `card_class_evidence` | Card ↔ learning item/recording evidence; an existing card can have multiple class references |

Processing state: `prepared → recording → uploading → queued → transcribing → extracting → ready`, with explicit `interrupted`, `failed`, `deleting`, and `deleted` states. Prepared sessions expire without media capture and release unused credit reservations. Failure records the stage and retry action. A missing channel or truncated class is a completeness flag, not an invented complete transcript.

Owner RLS applies to every table and private storage path. Validate ownership through parent joins as well as `user_id`; never permit a user to link their row to another user's recording or card. Restrict processing-state/output writes to validated control functions and workers.

Change card uniqueness from `(user, language, normalized front)` to `(user, language, kind, normalized front)` with backwards-compatible defaults. This distinguishes a grammar exercise from a vocabulary card with the same front. Avoid free-form kind values.

Approval must be transactional. On a dedup conflict, reuse the existing card, mark the candidate resolved as approved with an existing-card reference, and add class membership/evidence. Never discard the class association or reset an existing review schedule. Concurrent approvals must produce one card and one membership.

If listening work introduces `cards.batch_id`, it can remain a primary/origin batch for compatibility, but is insufficient for repeated words across lessons. Listening and class practice must query `batch_cards` and backfill legacy primary-batch memberships.

## 8. Cost, retention, and deletion

Recording itself should not consume AI credits. Processing is priced by recorded minutes plus note/extraction usage. Display an estimate and a maximum authorized charge before recording; enforce its duration/byte limits. Exact pricing and the initial provider remain implementation decisions based on the measured spike. Do not copy a fixed per-pack listening price onto hour-long transcription.

Reserve/settle credits idempotently per processing run. Release unused reservations on terminal failure; retries cannot double-charge. BYOK only applies when keys cover the actual transcription and text stages. Never silently switch a failing user key to platform-paid processing.

Proposed default: delete remote raw audio within 24 hours of a successful result; retain failed/interrupted uploads for seven days for retry, with the deadline shown. Keep notes and transcript until the user deletes the class. Retaining audio longer is a separate explicit preference. Timestamp references open transcript passages after raw audio expires; do not show playable audio links once it is gone.

Use short-lived signed audio URLs during retention. Never send full signed classroom URLs, page query strings, transcript text, or audio into analytics/error logs. If platform context is useful, store the platform label and a sanitized origin.

Deleting a class removes raw audio, transcripts, notes, pending suggestions, and evidence after cancelling or invalidating in-flight work. Offer **Keep approved cards** or **Delete cards used only by this class**. Shared cards and their review histories survive. Results from a deleted or superseded run cannot be republished. Cleanup failures retry visibly; provider retention/deletion behavior must be documented before release.

## 9. Acceptance gates

1. A real browser class records audible tutor and learner speech, with tutor playback intact, and the panel can close without ending capture.
2. An hour-long two-channel recording stays within measured memory/storage bounds; every acknowledged audio part decodes after assembly.
3. Network loss, service-worker suspension, tab closure, browser restart, expired auth, and duplicate finalization each preserve completed data and offer a clear recovery path.
4. Chinese/English and Thai/English fixtures preserve original target speech and time references, without inventing readings for unclear words.
5. Notes and extracted items cite real transcript segments; casual conversation is not indiscriminately turned into vocabulary.
6. Grammar and tutor corrections become editable application cards, with generated explanations distinguished from evidence.
7. Two classes from the same tutor on the same day remain separate in notes, triage, and practice.
8. A word repeated next class links to the existing card in both batches, preserving its FSRS state.
9. Cross-user IDs cannot read/upload/finalize/delete/approve another user's class. Replays cannot create duplicate jobs, cards, memberships, or charges.
10. Deletion during processing prevents output resurrection; expired raw audio disappears while transcript references still work.

## 10. Primary implementation references

Recheck these during the browser spike; API/version claims and store readiness are not validated by this design document alone.

- Chrome screen/audio capture: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- Tab capture API: https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- Offscreen document API: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- Side panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Storage and lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
