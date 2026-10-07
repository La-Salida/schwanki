# Schwanki Batch Listening — Lesson-Targeted TTS Dialogue Generation

Date: 2026-10-04
Status: approved design (open questions resolved 2026-10-04, pre-plan)
Builds on: `2026-09-23-schwanki-design.md` §1 (second-order differentiation), §7 (enrichment ladder); `2026-09-28-mnemonic-generation-design.md` (BYOK/credit pipeline, provider adapters)

## 1. Purpose

The user-visible half of the "one word set, every modality" positioning (main spec §1):
the 20 words your teacher just gave you become a ~90-second listening exercise using
*exactly those words* — not a podcast about someone else's vocabulary. Listening is
the first cross-modality render because audio infra (TTS adapters, storage, credit
pricing) already ships with mnemonics; this is product packaging, not new plumbing.

## 2. Core mechanic: the lesson batch as the unit

The batch is what triage already groups by (main spec §9.1). To make it addressable:

- **Dedicated `batches` table** (DECIDED): `id, user_id, source_id?, label
  (e.g. "Sep 30 lesson"), language, created_at`. Buys a place to hang the tutor
  brief + pack status, at the cost of one join.
- **`batch_id uuid` on `cards`** (nullable FK) — assigned at triage approval to all
  cards approved from one lesson group. Older/imported cards get batch_id lazily or
  never (they can still join the *known-word pool*, §4.1).
- A batch = "this week's practice set." All modality renders (listening now, tutor
  brief next, video later) key off it.

## 3. Trigger & placement in the app

1. **Triage completion screen** — after approving a batch: primary CTA
   "Make this week's listening 🎧" (credit cost shown on the button, like mnemonic
   per-kind badges). Skip is one tap; never auto-generates.
2. **New "Listen" tab in the PWA** (DECIDED: Listen is a separate practice tab;
   Review stays the home screen) — packs listed by week/batch, newest first.
   Player screen: audio + scrolling transcript, target words highlighted, tap a
   highlighted word → that card's detail. Playback speed 0.75×/1× (learner default
   0.75×), loop toggle.
3. **Push notification** when generation completes: brand voice, e.g.
   "Your teacher's 20 words are a podcast now. 90 seconds. No excuses."
4. Non-goals v1: no extension surface, no auto-regeneration on new lessons, no
   user-scripted scenarios ("make it about ordering food") — surprise-me only.

## 4. Generation pipeline (edge function `generate-listening`)

Same shape as `generate-mnemonic`: user-JWT guard, rate limit, BYOK-first key
resolution (never silently fall back to billing credits), credit check up front,
debit on success only.

### 4.1 Script generation (cheap text tier)

Input to the model:

- **Target words:** the batch's cards — front + back + reading verbatim.
- **Known-word pool:** user's cards past a FSRS familiarity bar
  (proposal: `stability ≥ 21 days OR reps ≥ 3`), sampled to ~40 words. This is the
  comprehensible-input constraint: the script is target words + known words +
  function words, nothing else new. i+1, enforced by construction.
- **Language + register:** source language; casual dialogue register.
- **Length target:** scaled to batch size — ~1 short exchange per 2 target words,
  capped ~90 seconds of audio.
- **Batch cap (DECIDED):** scripts cover at most 40 target words, oldest first;
  larger batches (bulk first-imports) overflow into sequential "part 2" packs.

Output: strict JSON `lines: [{speaker, text, translation}], words_used: [card_ids]`.
Same structured-output discipline as parser Tier 2 (§6.2).

### 4.2 Hard verification (deterministic, no LLM)

Every target word's `front` must appear in the script text (normalized match —
the same trim/lower rule as the dedup key, plus CJK substring match). Missing words
→ one retry with `missing: [...]` fed back to the model. Still missing → ship the
script with the gap flagged in the player ("3 words didn't make the cut") rather
than blocking; log for prompt tuning. Mirrors §6.3's language-validation rule:
content correctness is a pipeline feature, not vibes.

### 4.3 TTS render

- **Provider (DECIDED): ElevenLabs v3/v4 for listening packs.** Reliable tones for
  tonal languages come from voice choice, not pronunciation hinting: ship a curated
  per-language voice map seeded with *popular* ElevenLabs voices (popularity is the
  quality signal — heavily-used voices get the most tuning). Test on Chinese + Thai
  first, the two languages in `samples/`.
- Build implication: new provider adapter + `elevenlabs` entry in the
  `user_api_keys` provider registry (BYOK users bring their own ElevenLabs key,
  free path as usual). The mnemonic per-card audio adapters (OpenAI/fal) stay
  as-is; ElevenLabs is the listening-pack voice.
- Two-voice dialogue via ElevenLabs multi-voice; single narrator fallback.
- Tonal languages: the card's `reading` (pinyin/romanization) still goes into the
  script payload so misreadings can be corrected at the source-card level, not by
  editing audio.
- Audio → existing `card-media`-style storage bucket, owner-scoped paths.

### 4.4 Data model (proposed migration)

- **`batches`** — `id, user_id, source_id?, label (e.g. "Sep 30 lesson"), language, created_at`.
- **`listening_packs`** — `id, batch_id FK, script jsonb, audio_path, voices jsonb,
  model_used, cost_cents, status (queued | ready | failed), created_at`. Owner RLS.
- **`listening_pack_words`** — `pack_id, card_id, made_it bool` (join table; powers
  the transcript highlighting and the "didn't make the cut" flag).
- `llm_jobs` gains type `enrich_listening`; `credit_ledger` reason `enrich_listening`.

Regenerate replaces the pack (same rule as mnemonic media: never accumulates).

## 5. Credit cost

Real COGS per pack (batch of 20): script ≈ 1k tokens on Haiku/Flash-class ≈ $0.002;
ElevenLabs TTS ≈ 300–500 chars (per-plan character pricing — validate against the
plan tier during build; keep the ~50% gross-margin floor from §7.6).

- **Our keys: 2 credits per pack.** Sits in the mid tier with per-card TTS (§2),
  and is deliberately a bargain next to 20 × 1-credit per-card audios — the pack
  being the better deal *is* the pitch.
- **BYOK: free** (user's own ElevenLabs + text-model keys), same as everything else.
- **No transcript-only preview (DECIDED):** one code path, generate → audio. The
  CTA shows the 2-credit cost up front; that *is* the preview of commitment.

## 6. Sequencing

Fits **Phase 2** (money loop) after per-card TTS lands — it reuses the ledger and
key-resolution path verbatim, plus one new provider adapter (ElevenLabs). Natural
order: per-card audio → batch listening → tutor brief (text-only, near-free, shares
the `batches` table) → video clips. The tutor brief is the distribution play;
listening is the retention play.

## 7. Failure handling

- TTS provider failure → pack `failed`, no debit, retry CTA in the Listen tab.
- Storage write failure after render → discard, no debit, error surfaced (same as
  mnemonic rule).
- Partial script (words missing after retry) → ships flagged, full debit (the audio
  is real), counts toward prompt-quality telemetry.

## 8. Decisions log (resolved 2026-10-04)

| # | Question | Decision |
|---|---|---|
| O1 | Dedicated `batches` table vs. bare `batch_id` | **Table** — hangs tutor brief + pack status |
| O2 | TTS pronunciation quality for tonal languages | **ElevenLabs v3/v4, curated popular voices per language** — reliability via voice choice, not hinting. New adapter + BYOK provider entry. Validate on zh + th samples |
| O3 | Free transcript-only preview | **No** — single code path, cost shown on the CTA |
| O4 | Batch size cap | **40 target words per pack, oldest first; overflow → "part 2" packs** |
| O5 | Listen tab nav placement | **Separate practice tab; Review stays the home screen** |
