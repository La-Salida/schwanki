# Schwanki — Design Spec

**Date:** 2026-09-23
**Status:** Approved design, pending implementation plan
**Product:** An Anki-style spaced-repetition app that auto-builds decks from the documents language tutors already use (Google Sheets/Docs, PDFs, tutoring-platform chats), enriched with AI-generated example sentences, audio, images, and video.

---

## 1. Vision & Positioning

Language learners on tutoring platforms (Preply, iTalki) accumulate vocabulary in whatever format each teacher happens to use: one keeps a Google Sheet, another a Google Doc, another sends PDF lesson notes, another types vocab into the platform chat. Anki's UX is hostile enough that learners rarely convert these notes into decks — the data exists, the work of re-entering it doesn't get done.

Schwanki owns the moment vocabulary is created. Connect the sources once; every lesson's new words flow into a triage inbox, then into a spaced-repetition deck reviewable on your phone, enriched with memorable AI-generated context.

**Differentiation is the data pipeline, not the flashcard app.** SRS is a solved commodity (FSRS is open source). The moat is normalization: turning every teacher's chaotic note format into clean cards.

**Brand:** "Schwanki" deliberately echoes Anki while signaling something spicier, irreverent, countercultural. Brand is not a coat of paint — it drives mascot, typography, color, microcopy, push notifications, and marketing. Duolingo's unhinged-owl era proves personality is a growth engine in language learning; Schwanki is the adult-irreverent cousin. (See §9.)

**Business stance:** designed as a monetizable product from day one, built first as the founder's personal tool (dogfooding is the Phase 1 success criterion).

---

## 2. Business Model

**Hybrid subscription + credits, with BYOK (bring your own keys).**

- **Subscription (~$5–6/mo target)** — the packaged product: source connections, unlimited sync, triage inbox, SRS review, PWA + extension, push reminders. This is the access fee.
- **Credits** — the AI fuel. Sold in packs; a small monthly grant included with subscription (creates a use-it-or-lose-it engagement nudge). Every enrichment job is priced in credits proportional to its real COGS:
  - Example sentence / mnemonic note — cheapest tier (Haiku/Flash-class models)
  - TTS audio — mid tier (essential for tonal languages)
  - Image mnemonic — higher tier
  - Video in-context clip — premium; priced honestly in credits, which solves its unit economics without a separate plan
- **BYOK** — users who supply their own LLM/TTS API keys pay subscription only. Keys are stored server-side, encrypted at rest (Supabase Vault / pgsodium), never logged, never sent to the client. BYOK users are near-zero marginal COGS and high-evangelism power users; "your keys, your models, we never mark up your tokens" is also a marketing line.

**Enrichment gate logic:** one job pipeline, two funding sources — BYOK routes to the user's provider; otherwise credits are spent from the ledger and the job routes to Schwanki's provider pool.

**Strategic sequencing:** learner subscription first; tutor-led distribution emerges organically (tutors see students actually reviewing between lessons) and becomes the growth lever later. Platform partnerships (Preply/iTalki) are a Phase 4 pitch armed with retention data — never a dependency.

---

## 3. Ground Truth: Real Source Data

Design is based on four real teacher sources (samples in `samples/`, to be anonymized into test fixtures):

| Source | Structure | Quality issues observed |
|---|---|---|
| Google Sheet (Chinese) | ~670 rows, no headers: `date? \| word \| translation \| pinyin` | Duplicate entries, trailing `#VALUE!` error rows, mixed simplified/traditional, mostly-empty date column |
| Google Doc (Thai) | **Two formats in one doc**: tab-separated table, then per-word sections `word (pron) — meaning` + `* example` + `→ translation` | Teacher's own non-standard romanization, typos ("arrrive"), merged cells |
| PDF lesson notes (Chinese) | Text-layer PDF: `* word translation` bullets, `-- example` sentences | Chinese/English mixed inline within sentences, pinyin fused into characters (恶ě心), topic headers interleaved |
| Preply chat | Freeform messages | Fully unstructured |
| Google Doc #2 | Private (401 on unauthenticated fetch) | Proves OAuth is in the critical path |

**Data-mutation model (key assumption):** source documents are **append-mostly and lesson-paced**. Teachers add a small batch of new vocab after each class to an otherwise stable document. Sync is therefore optimized for "detect a small diff on a large doc," and the triage inbox groups candidates by lesson/date batch. Bulk re-import is the exception (first connect), not the rule.

**Design conclusions from the data:**

1. No regex-only pipeline survives this. Normalization is LLM-based with a deterministic fast path (see §6.2).
2. Dedup, language validation, and error-row filtering are first-class features, not afterthoughts.
3. Google OAuth is unavoidable (private docs) → v1 starts with Google sources; PDF upload and Preply chat (extension) are fast-follows.
4. Teacher content is never silently auto-corrected. The parser normalizes *formatting*, not *content*; typos surface in triage for the human to fix.

---

## 4. Architecture

**Approach: Supabase-centric, edge-function pipelines.** One platform provides Postgres, Auth (with Google OAuth + provider refresh tokens — exactly what reading private Docs/Sheets needs), Storage, Edge Functions, and scheduling.

**Stack:** pnpm monorepo, strict TypeScript everywhere. Built entirely by AI agents → optimize for agent legibility: one language, boring mainstream frameworks with massive training data, small well-bounded modules, heavy test coverage (tests are how AI builders self-verify).

### 4.1 Monorepo layout

```
apps/
  web/          React PWA — review UI, deck management, source connections
                (Vite + Tailwind + shadcn/ui)
  extension/    Chrome extension (MV3) — Preply/iTalki chat capture + "Schwanki this"
packages/
  core/         Platform-agnostic TS: FSRS scheduler (ts-fsrs), card/review types,
                API client, sync logic. Zero DOM deps — future Expo app imports it untouched.
  parsing/      Source normalizers: heuristics + LLM structured-output parsers.
supabase/
  migrations/   Postgres schema
  functions/    Edge Functions: sync-google, sync-pdf, parse-queue, enrich-queue, push-notify
```

### 4.2 Component responsibilities

1. **`web` (PWA)** — the entire UX: review session (due cards cached in IndexedDB for offline), deck/source management, card editing, enrichment preview. Talks to the backend only via `core`'s API client. Installable, offline-capable, Web Push reminders (iOS PWA 16.4+ supported).
2. **`core`** — FSRS scheduling, review-event creation, all type contracts. Portable to the future Expo app without change (the migration path is: rewrite screens, reuse everything else).
3. **`parsing`** — the core IP. Per-source-type parser modules behind one interface: `parse(rawContent, sourceMeta) → CandidateCard[]`. Prompt templates are versioned like code and carry the Schwanki voice for generated content.
4. **Edge Functions** — scheduled sync workers (Drive/Docs/Sheets API via stored OAuth refresh tokens), PDF text extraction, and two Postgres-backed job queues (`llm_jobs`): `parse-queue` and `enrich-queue`. Queue-in-Postgres means workers can move off Supabase later without redesign.
5. **Push notifications** — daily review reminder; streak nudges in brand voice.

### 4.3 Platform decision record

- **PWA over Expo/RN Web for v1.** The UI layer never migrates between DOM and RN either way; business logic (in `core`) is what's portable, and it ports regardless. The desktop web app is a dense admin surface (tables, hover states, text selection) where RN Web is mediocre and React+Tailwind is elite; the Chrome extension is pure DOM tech; and AI builders write React+Tailwind far more reliably than RN Web edge cases. Expo arrives in Phase 4, consuming `core`.
- **No local-first sync engine (PowerSync/ElectricSQL) in v1.** Review events are append-only and single-user; conflicts are near-nonexistent. The append-only `review_events` log keeps the door open.

### 4.4 Data flow (happy path)

Connect Google (Supabase Auth stores refresh token) → add Doc/Sheet URL → `sync-google` fetches, diffs against `content_hash` → changed chunks → `llm_jobs` parse queue → `parsing` emits `CandidateCard[]` → **triage inbox** (confirm / edit / discard) → approved cards enter deck → `enrich-queue` generates sentence/audio/image async (credit-gated) → FSRS schedules → reviews append to `review_events`.

---

## 5. Data Model (Postgres / Supabase)

- **`sources`** — `id, user_id, type (google_sheet | google_doc | pdf_upload | preply_chat | manual), external_ref, label, language, last_synced_at, content_hash, status (active | error | revoked), error_detail`. `content_hash` enables cheap change detection.
- **`candidate_cards`** (triage inbox) — `id, source_id, front, back, reading, example_sentence, raw_context, status (pending | approved | discarded), confidence, parse_notes`. `raw_context` preserves exactly what the parser saw, for debugging and user trust. `confidence` sorts sketchy parses first.
- **`cards`** — `id, user_id, source_id (nullable), language, front, back, reading, example_sentence, enrichment_status (none | queued | partial | complete), created_at`. Unique index on normalized dedup key `lower(trim(front)) + language` — duplicates die at the DB level.
- **`card_media`** — `card_id, type (mnemonic_sentence | audio | image | video), url_or_text, model_used, cost_cents, status`. Separate table so cards exist before/without enrichment; `cost_cents` feeds pricing telemetry.
- **`review_events`** — append-only: `card_id, reviewed_at, rating (again|hard|good|easy), elapsed_ms, fsrs_state_before`. Never updated. Enables analytics and future offline sync.
- **`card_state`** — FSRS state per card: `due_at, stability, difficulty, reps, lapses, last_reviewed_at`.
- **`llm_jobs`** — queue: `type (parse | enrich_sentence | enrich_audio | enrich_image | enrich_video | ocr), payload, status, attempts, run_after`.
- **`credit_ledger`** — append-only: `user_id, delta, reason (purchase | subscription_grant | enrich_*), job_id`. Balance = sum; never a mutable counter.
- **`user_api_keys`** — `user_id, provider, encrypted_key, validated_at`. Server-side only, encrypted at rest.

**First-class `reading` field** (pinyin/romanization) — real sources carry pronunciation data; most flashcard apps treat it as an afterthought. **Multi-language is native** from row one (`language` on sources and cards).

---

## 6. Ingestion Pipeline

### 6.1 Connectors

| Connector | Mechanism | Trigger |
|---|---|---|
| Google Sheet / Doc | Drive + Docs/Sheets APIs via Supabase Google OAuth refresh token. Handles private docs. | Scheduled poll (6 h) + manual "sync now". No-change syncs are free via `content_hash`. |
| PDF upload | Drag-drop in PWA → Supabase Storage → text-layer extraction; OCR queue only when no text layer. | On upload. |
| Preply/iTalki chat | Extension content script scrapes lesson-chat DOM on page visit → posts to API. No platform cooperation needed. | Passive, on visit. |
| Manual | "Add word" form in PWA + extension right-click. | Instant. |

**Deliberate cut:** no direct Canva connector in v1 — Canva has no useful export API; Canva content arrives as PDFs and the PDF connector covers it.

### 6.2 Two-tier normalization (`packages/parsing`)

- **Tier 1 — deterministic heuristics.** Columnar sheets and tab-separated tables parse by rule (~90% of the real Sheet sample): strip `#VALUE!` rows, normalize date cells, map columns. Zero LLM tokens, instant. Tier 1 also emits `confidence`; anomalous rows (empty translation, suspicious length ratio) escalate to Tier 2.
- **Tier 2 — LLM structured output.** Strict JSON schema (`front, back, reading?, example?, confidence`) on cheap models (Haiku/Flash class). Handles mixed-format docs, prose, mixed-script sentences, fused pinyin (恶ě心 → 恶心 + ě), and chat messages.
- Both tiers emit the same `CandidateCard[]` into the triage inbox.

### 6.3 Cross-cutting rules

- **Dedup at three layers:** within-batch, against pending candidates, against the deck (DB unique key).
- **Language validation** per candidate against the source's declared language — catches cross-language contamination (an English gloss must not become a target-language card front).
- **Never auto-correct teacher content.** Formatting is normalized; content typos surface in triage.
- **Incremental-by-default sync:** only diffed chunks hit the parser (a 670-row sheet after one lesson processes ~15 new rows). This matches the append-mostly, lesson-paced data model (§3).
- **Failure isolation:** one errored source (revoked OAuth, moved doc) never blocks others; `sources.status`/`error_detail` surface in UI ("Sheet sync failed: permission revoked — reconnect").

### 6.4 Parser testing

The real samples become **anonymized golden fixtures**: `packages/parsing/test/fixtures/` with expected `CandidateCard[]` outputs per source. Every parser change runs against them. The fixtures are the executable spec of parser behavior and the AI builders' self-verification mechanism.

---

## 7. AI Enrichment & Cost Model

1. **Teacher examples first, AI second.** Real sources often contain example sentences; the pipeline reuses them before generating anything — cheaper and pedagogically better (the sentence from your actual lesson).
2. **On-demand, batched, never auto-enrich-everything.** Cards enter bare; enrichment happens in batch at inbox approval ("enrich these 12") or lazily from the review screen. Prevents the classic cost blowout of enriching 670 unreviewed imports.
3. **Enrichment ladder & gates:** sentence/mnemonic (cheapest) → TTS audio → image → video (premium credits). All credit-priced per §2; BYOK bypasses credit spend.
4. **Model routing abstraction:** one interface `enrich(card, type) → media`; providers swappable per tier without touching app code (model prices shift monthly).
5. **Voice in generation:** enrichment prompts carry Schwanki tone — memorable, slightly spicy sentences, not textbook-bland. Templates versioned in `packages/parsing`.
6. **Cost observability:** `cost_cents` on `card_media` + `credit_ledger` give per-user margin telemetry; pricing targets ~50%+ gross margin on credit spend and is validated against real usage in Phase 2.

---

## 8. Chrome Extension & Platform Strategy

**v1 features:**
1. **Chat capture** — content script detects Preply/iTalki lesson-chat DOM, one-click (or passive) "Send to Schwanki" → triage inbox as a `preply_chat` source.
2. **Universal "Schwanki this"** — right-click selected text on any page → candidate card with surrounding sentence and source URL. Useful far beyond tutoring platforms (news, subtitles, social) — the sleeper distribution feature.
3. **Inbox badge** — pending-candidate count on the icon; click opens the PWA inbox. Capture on desktop, review on phone.

**Strategic rules:**
- **Zero platform cooperation required.** Content scripts read what the user can already see — same footing as read-later/grammar extensions. Partnership is a Phase 4 pitch backed by retention data, never a dependency.
- **Brittleness hedge:** DOM selectors live in remotely-updatable config, not hard-coded — platform redesigns don't require a store review cycle to fix.
- **Store listing = zero-CAC acquisition:** "Preply vocabulary," "iTalki flashcards" keywords reach the exact ICP.
- **v1 non-goals:** no full chat-history auto-sync (noise), no UI injection into platforms (ToS/fragility), Chrome-only.

---

## 9. UX Flows & Brand

### 9.1 Core flows

- **Connect & first sync (aha flow):** Google sign-in → add source link/upload → sync+parse → "Found 47 words in your 09/16 lesson" → triage → cards exist. Brand promise must land in <2 minutes, first session, no tutorial. Onboarding *is* the first sync.
- **Triage (30-second habit):** candidates grouped by lesson batch (per the append-mostly model); swipe approve/discard, tap to edit, "approve all" fast path, confidence-sorted.
- **Review (the Anki-killer):** PWA opens directly into the session — one tap to flip. Front (word + reading) → back (translation + teacher/AI example + media) → four FSRS ratings. Streak screen with full Schwanki attitude; push reminder at user-chosen hour.

### 9.2 Design direction

- **Typography-led:** big bold editorial type; the word is the hero; minimal chrome. Spicy accent on warm off-black or paper-cream — no Duolingo green, no SaaS blue/pastel.
- **Mascot:** an unhinged anti-Duo — roasts you in push copy and you love it. Appears in empty states, streaks, notifications.
- **Microcopy is the brand:** a `copy.md` voice guide ships in the repo so AI builders never drift into "Oops! Something went wrong."
- Visual exploration (Mobbin screen search, mascot/concepts via image generation) happens as its own pass during implementation.

---

## 10. Error Handling & Testing Philosophy

- Sync/parse/enrichment failures surface per-source in UI with actionable copy; never silent.
- Parsing ambiguity defaults to the triage inbox — never auto-commit garbage cards.
- Golden fixtures (§6.4) for parsers; unit tests for `core` (FSRS, sync, credit math); integration tests for Edge Function queues. Tests are the AI builders' verification loop — coverage is an architectural requirement, not a nicety.

---

## 11. Phased Roadmap

- **Phase 1 — Core loop (personal-tool milestone):** Google Sheet/Doc connectors, two-tier parser, triage inbox, FSRS review PWA, push notifications. *Success: founder reviews daily for 2 straight weeks, replacing the Anki deck.*
- **Phase 2 — Money loop:** subscriptions, credit ledger, enrichment (sentences, TTS, images), BYOK, PDF upload connector. *Success: enrichment margin math holds on real usage.*
- **Phase 3 — Distribution:** Chrome extension (chat capture + "Schwanki this"), PDF OCR polish, video enrichment, referral mechanics.
- **Phase 4 — Platform play:** Expo mobile app off `packages/core`, tutor-facing shared decks, Preply/iTalki partnership pitch with retention data.

Each phase ships a usable product; no phase depends on platform cooperation.

---

## 12. Explicit Non-Goals (v1)

- Native mobile apps (PWA covers it; Expo in Phase 4)
- Direct Canva integration (PDF connector covers the content)
- Platform APIs/partnerships (no dependency; Phase 4 upside)
- Social/shared decks, marketplace, gamification beyond streaks
- Local-first sync engine (append-only log keeps the option open)
- Auto-correction of teacher content
