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
| Monetization | No subscription. BYOK (any supported provider) = free forever; our keys = per-use credits. No payments in v1 |
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
  balance = `sum(delta)`. Debit rows only on full success; manual grant rows by us.
  1 generation = 1 credit (flat, all three kinds).
- Storage bucket `card-media`, owner-scoped paths `user_id/card_id/…`, storage RLS.

## 4. Edge function `generate-mnemonic`

User-JWT required (explicit guard, like sibling functions). Rate limit 30/hour/user.
Input: `{ cardId, hook?: string }`.

Pipeline:
1. **Key resolution:** user's key for the needed provider → free path. Else our env
   keys → credit path. Order matters: if a user's key exists and fails, surface the
   failure — NEVER silently fall back to billing credits.
2. Credit path: check balance ≥ 1 before starting; debit only on full success.
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
  back ("key saved ✓"). Credit balance display.
- **Review back face only in v1** (candidates have no card to attach media to;
  generation after first review appearance): "Make it memorable 🪿" → popover:
  - hook input ("your association… optional") + 🎲 surprise-me
  - indicator: "using your keys" or credit balance
  - generation progress: single generating state in v1 ("The goose is painting…");
    per-kind progress (sentence ✓ → image ✓ → audio ✓) is v1.1
  - existing media renders under the flipped card: image, sentence + play button,
    hook shown small
  - v1 regenerates the whole generation (the `unique(card_id, kind)` constraint
    makes regeneration replace-in-place); per-kind regenerate is v1.1 — after a
    partial failure the next full generate retries the failed kinds and only
    bills when all three finally succeed
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
