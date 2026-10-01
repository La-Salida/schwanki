# Schwanki Mnemonic Generation — Sentence + Image + Audio per Card

Date: 2026-09-28
Status: approved design (brainstorming complete, pre-plan)
Builds on: `2026-09-23-schwanki-design.md` (Phase 1 core loop, implemented)

## 1. Purpose

Cards currently carry front/reading/back/example — text only. The feature that makes
Schwanki more than "Anki with better UX": on-demand AI generation of a **memorable
scene** for a card — an example sentence, an image of that scene, and TTS audio of
the sentence — co-created with the user, whose own association is the mnemonic hook.

## 2. Decisions log (from brainstorming)

| Question | Decision |
|---|---|
| Trigger | On-demand per card ("Make it memorable 🪿"), never automatic |
| Co-creation | Prompt-assist: user's own association ("hook") seeds the generation; 🎲 surprise-me when empty |
| Media types v1 | Sentence (target language + translation) + image + TTS audio. Video is v2 premium |
| Monetization | No subscription. BYOK (any supported provider) = free forever; our keys = per-use credits, priced per kind (sentence 0, image 1, audio 1; both media in one run = 1 "scene bundle"). No payments in v1 |
| Architecture | Provider-adapter registry behind one server-side edge function; BYOK and credits share one code path |
| Key storage | `user_api_keys`, write-only RLS (same pattern as `user_google_tokens`) |
| Payments | Out of v1. Manual credit ledger; grants by us; Stripe later as its own project |

## 3. Data model (migration `0005_mnemonics.sql`)

- `user_api_keys (user_id, provider, api_key)` — write-only RLS. Providers shipped:
  `anthropic`, `openai`, `fal`, `together`, `higgsfield`.
- `card_media (id, card_id FK, generation_id uuid, kind 'sentence'|'image'|'audio',
  content text | storage_path, prompt_used text, provider text, created_at)` —
  owner RLS. One full generation = 3 rows sharing a `generation_id`. Regenerate
  replaces (deletes prior row of that kind), never accumulates.
- `credit_ledger (user_id, delta int, reason text, generation_id?, created_at)` —
  balance = `sum(delta)`. Debits are proportional per kind (CREDIT_COST: sentence 0,
  image 1, audio 1; both media kinds attempted on our keys in one run = 1 scene
  bundle) and only for kinds that succeeded via our keys; manual grant rows by us.
- Storage bucket `card-media`, owner-scoped paths `user_id/card_id/…`, storage RLS.

## 4. Edge function `generate-mnemonic`

User-JWT required (explicit guard, like sibling functions). Rate limit 30/hour/user.
Input: `{ cardId, hook?: string, models?: { sentence?, image?, audio? }, kinds?: MediaKind[] }`
(kinds defaults to all three; per-kind runs reuse the card's stored sentence when
image/audio are requested without one — sentence auto-joins the run if absent).
A run is free when every kind it attempts resolves to a user key; the credit path
gates on `runCost(attempted ∩ ours)` up front and debits `runCost(attempted ∩ ours ∩
succeeded)` after persistence.

Sentence model selection (v1.1): the client may send a model id (curated list or
custom OpenRouter slug like `deepseek/deepseek-chat`, `z-ai/glm-4.6`). The server
derives the kind's provider from the model (registry → per-kind prefix heuristics;
unresolvable non-empty id → 400) and resolves
BYOK-first for that provider as usual. A model whose provider has no
user key simply takes the credit path (per-kind pricing applies). Without a model, capability-order resolution
picks the sentence provider (anthropic, openai, openrouter — last).

Pipeline:
1. **Key resolution:** user's key for the needed provider → free path. Else our env
   keys → credit path. Order matters: if a user's key exists and fails, surface the
   failure — NEVER silently fall back to billing credits.
2. Credit path: check balance ≥ runCost(attempted ∩ ours) before starting; debit
   only for kinds that succeeded via our keys (scene-bundle cap when both media run).
3. **Sentence** (Claude/GPT adapter): target-language scene sentence + translation,
   built around the hook (or surprise-me), card's front/reading/back passed verbatim.
4. **Image** (fal SDXL-class default; adapter per provider) from the sentence scene.
5. **TTS** of the sentence in the target language (OpenAI/fal audio adapter).
6. Write up to 3 `card_media` rows + storage files; return artifacts.

Partial failure: keep what succeeded, report failed kinds; credit debit only on full
success (sentence is free on partial; failed media kinds refunded — generous, simple).
Storage write failure after generation: discard, no debit, error surfaced.

## 5. Web app

- **Settings page:** API keys section — add/remove per provider; keys never readable
  back ("key saved ✓"). Credit balance display. Capability matrix ("What your keys
  unlock"): per-kind ✓/✗ rows (text/image/audio/video — video locked "coming in v2")
  computed from saved keys vs the capability map, with an overall free/credit verdict
  and a pickable-models list showing per-model free/1-credit badges.
  Model lists are fetched LIVE from each provider's listing endpoint (OpenRouter
  /models, ElevenLabs /v1/models, OpenAI/Anthropic/Together /v1/models) via the
  `list-models` edge function — keys stay server-side; curated registries are
  fallback only; fish/fal/higgsfield have no listing API and stay curated.
- **Review back face only in v1** (candidates have no card to attach media to;
  generation after first review appearance): an inline "✨ Make it memorable" section
  on the flipped card (no popover, no hidden icon triggers):
  - primary CTA "✨ Generate memorable scene" (all three kinds) + 🎲 surprise-me
  - per-kind actions "Memorable sentence" / "Scene image" / "Pronunciation audio"
    (v1 — image/audio reuse the stored sentence or generate one first)
  - hook input ("your association… optional")
  - per-kind model pickers under a collapsible "Model choices" (curated registry +
    custom slug each, remembered per device); chosen models override that kind's
    provider server-side (BYOK-first, else our keys = credit path)
  - capability indicator "text ✓ · image ✓ · audio ✓" + "using your keys — free"
    or the per-kind cost line; paywall shown when kinds are uncovered AND balance
    can't cover them (matches server billing; the free sentence action stays)
  - generation progress: single generating state in v1 ("The goose is painting…")
  - existing media renders under the section: image, sentence + play button,
    hook shown small
  - regeneration replaces in place (`unique(card_id, kind)`), per kind or full
- Review overview (v1.2): the Review page opens on a per-teacher dashboard — one
  card per source with platform icon (💬 Preply, 📄 Doc, 📊 Sheet, 📕 PDF, ✍️ manual),
  language flag, FSRS-due/total counts (and new-card split), platform + last-synced
  metadata, and sync-health warnings. Tapping a teacher starts a session filtered to
  that source; "Review everything" runs the combined queue.
- Deck bulk generation (v1.2): "Generate for a deck" (teacher or language scope,
  all teachers inclusive) with skip-existing targeting, an exact up-front credit
  estimate (smart-pick models only, so estimate = bill), balance gating, and a
  sequential client-driven run with live progress, per-card failures, and stop/
  resume. BYOK (free-path) runs are exempt from the hourly rate limit; credit-path
  runs keep it.
- Async deck generation (v1.3): bulk runs are fully server-side. The modal's
  Generate enqueues one `bulk_jobs` row per card (chunked PostgREST inserts of
  100) and closes immediately; a per-minute cron drains the queue via
  `bulk-worker` (service-role-only, claims 5 with `claim_bulk_jobs` SKIP LOCKED,
  ~300 cards/hour pace) through the same `pipeline.ts` as the HTTP path, so
  billing/key/partial-failure rules are single-sourced. A 429 puts the job back
  to pending with `run_after = +10min` without burning an attempt; anything else
  marks it failed with the error. The Review overview carries a background
  banner (5s poll while active, 15s idle): "✨ Generating — N done · M failed ·
  K queued · Stop"; Stop deletes the caller's still-pending rows (RLS — running
  jobs finish), and a drained queue shows the final tally until dismissed.
  Closing the tab changes nothing; media appears on cards as the worker lands it.
- Cards without media render exactly as today; review never blocks on media.
- No key + zero credits → honest paywall copy: "Add your own key (free forever) or
  get credits" — not a dead button.
- Hook is prompt-quoted user content server-side and escaped on every render surface.

## 6. Testing

- **Unit (vitest):** adapters vs recorded fixtures (success / 401 / 429 / malformed);
  prompt builder (hook vs surprise-me; card fields verbatim; hook quoting).
- **Edge (deno test):** auth guard; key-resolution order (user key wins; no silent
  fallback to credits); balance check; debit-on-full-success-only; partial refund;
  rate limit.
- **Component:** popover states (idle / generating / done / error / paywall);
  per-kind regenerate.
- **E2E dogfood:** founder's real keys in Settings → 3 real cards (hook, surprise-me,
  regenerate) → media in Review, survives reload.

## 7. Out of scope (YAGNI)

- Video generation (v2 premium, ~10× credits)
- Stripe / credit pack purchase
- Sharing/discovering mnemonics across users
- Media on the card FRONT (spoils recall)
- TTS of the bare word (sentence audio covers it)

## 8. Definition of done

1. `pnpm -r test` / `typecheck` green; `deno test` green for `generate-mnemonic`.
2. Founder adds own fal/OpenAI/Anthropic keys via Settings (never readable back).
3. Hook generation on a real card: sentence honors the hook, image matches the
   sentence scene, audio plays the sentence — all visible in Review after reload.
4. Surprise-me generation works with empty hook.
5. Remove keys, zero balance → paywall copy; grant 1 credit via SQL → one generation
   succeeds, balance 0, ledger shows grant + debit.
6. Kill a provider (bad key) → failure surfaces, zero credits touched.
