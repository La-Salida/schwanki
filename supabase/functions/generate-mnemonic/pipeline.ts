import { createClient } from "@supabase/supabase-js";
import {
  buildSentencePrompt, parseSentenceResponse, buildImagePrompt,
  createSentenceProvider, createImageProvider, createTtsProvider,
  resolveKeys, providerForModel, runCost,
} from "@schwanki/mnemonic";
import type { MediaKind } from "@schwanki/core";
import { OUR_KEY_ENV, rateLimited, storagePath, normalizeModels, normalizeKinds, normalizeVoice } from "./lib.ts";

export interface GenerationParams {
  cardId?: string;
  hook?: string;
  kinds?: unknown;
  models?: unknown;
  voice?: unknown;
}

export interface GenerationOutcome { status: number; body: Record<string, unknown> }

/** The single generation pipeline, shared by the HTTP handler (generate-mnemonic)
 *  and the async bulk worker. `user` is the authenticated user id — everything
 *  (ownership, keys, billing) derives from it. */
export async function runGeneration(user: { id: string }, rawParams: GenerationParams): Promise<GenerationOutcome> {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { cardId, hook, kinds: bodyKinds, models: bodyModels, voice: bodyVoice } = rawParams;
  if (!cardId) return { status: 400, body: { error: "cardId required" } };
  if (hook && hook.length > 500) return { status: 400, body: { error: "hook too long" } };

  const voice = normalizeVoice(bodyVoice);
  if (voice === null) return { status: 400, body: { error: "invalid voice" } };

  const normalizedKinds = normalizeKinds(bodyKinds);
  if (bodyKinds !== undefined && normalizedKinds === null) {
    return { status: 400, body: { error: "invalid kinds" } };
  }
  let attempted: MediaKind[] = normalizedKinds ?? ["sentence", "image", "audio"];

  const normalized = normalizeModels(bodyModels);
  if (bodyModels !== undefined && normalized === null) {
    return { status: 400, body: { error: "invalid models" } };
  }
  const models = normalized ?? {};

  // Load the card + verify ownership
  const { data: card } = await admin.from("cards").select("*").eq("id", cardId).eq("user_id", user.id).single();
  if (!card) return { status: 404, body: { error: "card_not_found" } };

  // Sentence dependency: image/audio may be requested without sentence —
  // reuse the card's EXISTING sentence row (not a billable attempt); if there
  // is none, sentence auto-joins the attempted set.
  let sentence = "", translation = "";
  let reusedPromptUsed: string | null = null;
  if (!attempted.includes("sentence") && (attempted.includes("image") || attempted.includes("audio"))) {
    const { data: existing } = await admin.from("card_media")
      .select("content, prompt_used")
      .eq("card_id", cardId)
      .eq("kind", "sentence")
      .maybeSingle();
    let reused = false;
    if (existing) {
      try {
        const v = JSON.parse(existing.content ?? "") as { text?: unknown; translation?: unknown };
        if (typeof v.text === "string" && typeof v.translation === "string") {
          sentence = v.text;
          translation = v.translation;
          reusedPromptUsed = existing.prompt_used;
          reused = true;
        }
      } catch {
        // corrupt row → treat as absent and regenerate the sentence
      }
    }
    if (!reused) attempted = ["sentence", ...attempted];
  }

  // Key resolution: user's BYOK keys first (write-only table — service role reads)
  const { data: keyRows } = await admin.from("user_api_keys").select("provider, api_key").eq("user_id", user.id);
  const userKeys = Object.fromEntries((keyRows ?? []).map((r) => [r.provider as keyof typeof OUR_KEY_ENV, r.api_key as string]));
  const keys = resolveKeys(userKeys);
  for (const kind of ["sentence", "image", "audio"] as const) {
    const id = models[kind];
    if (!id) continue;
    const p = providerForModel(kind, id);
    if (!p) return { status: 400, body: { error: `unknown ${kind} model`, failures: [], billed: false } };
    keys[kind] = userKeys[p]
      ? { provider: p, apiKey: userKeys[p]!, ours: false }
      : { provider: p, apiKey: "", ours: true };
  }
  // Free iff every kind this run ATTEMPTS resolved to a user key
  const free = attempted.every((k) => !keys[k].ours);

  // Rate limit protects OUR key spend — BYOK (free-path) runs are exempt so decks
  // can bulk-generate on the user's own keys; credit-path runs keep the hourly cap.
  if (!free) {
    const { count } = await admin.from("card_media")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("created_at", new Date(Date.now() - 3600_000).toISOString());
    if (rateLimited(count ?? 0)) return { status: 429, body: { error: "rate_limited" } };
  }

  // Credit path: fill our key slots from env, check balance BEFORE any provider call
  let balance = 0;
  if (!free) {
    for (const kind of ["sentence", "image", "audio"] as MediaKind[]) {
      if (keys[kind].ours) keys[kind].apiKey = Deno.env.get(OUR_KEY_ENV[keys[kind].provider]) ?? "";
    }
    const { data: ledger } = await admin.from("credit_ledger").select("delta").eq("user_id", user.id);
    balance = (ledger ?? []).reduce((n, r) => n + (r.delta as number), 0);
    const needed = runCost(attempted.filter((k) => keys[k].ours));
    if (balance < needed) return { status: 402, body: { error: "no_credits", balance } };
    for (const kind of attempted) {
      if (keys[kind].ours && !keys[kind].apiKey) {
        return { status: 500, body: { error: `server missing key for ${keys[kind].provider}` } };
      }
    }
  }

  const generationId = crypto.randomUUID();
  const promptUsed = hook?.trim() || (reusedPromptUsed ?? null);
  const failures: MediaKind[] = [];
  const succeeded = { sentence: false, image: false, audio: false };

  // 1. Sentence (hard dependency for image prompt — if this fails, abort).
  // Skipped entirely when an existing sentence row is being reused.
  if (attempted.includes("sentence")) {
    try {
      const raw = await createSentenceProvider(keys.sentence.provider, keys.sentence.apiKey, models.sentence)
        .generateSentence(buildSentencePrompt({
          id: card.id, userId: card.user_id, sourceId: card.source_id, language: card.language,
          front: card.front, back: card.back, reading: card.reading ?? undefined,
          exampleSentence: card.example_sentence ?? undefined, createdAt: card.created_at,
        }, hook));
      ({ sentence, translation } = parseSentenceResponse(raw));
      succeeded.sentence = true;
    } catch (e) {
      // NEVER fall back to our keys on a user-key failure (would silently bill)
      return { status: 502, body: { error: `sentence failed: ${(e as Error).message}`, failures: [...attempted], billed: false } };
    }
  }

  // 2. Image + 3. Audio (independent — partial success allowed)
  let imagePath: string | undefined, audioPath: string | undefined;
  if (attempted.includes("image")) {
    try {
      const bytes = await createImageProvider(keys.image.provider, keys.image.apiKey, models.image)
        .generateImage(buildImagePrompt(sentence, translation));
      imagePath = storagePath(user.id, cardId, generationId, "image");
      const up = await admin.storage.from("card-media").upload(imagePath, bytes, { contentType: "image/png" });
      if (up.error) throw new Error(up.error.message);
      succeeded.image = true;
    } catch (e) {
      console.error("image failed", e);
      failures.push("image"); imagePath = undefined;
    }
  }
  if (attempted.includes("audio")) {
    try {
      const bytes = await createTtsProvider(keys.audio.provider, keys.audio.apiKey, models.audio, voice)
        .generateSpeech(sentence, card.language);
      audioPath = storagePath(user.id, cardId, generationId, "audio");
      const up = await admin.storage.from("card-media").upload(audioPath, bytes, { contentType: "audio/mpeg" });
      if (up.error) throw new Error(up.error.message);
      succeeded.audio = true;
    } catch (e) {
      console.error("audio failed", e);
      failures.push("audio"); audioPath = undefined;
    }
  }

  // Persist rows (upsert per (card_id, kind) so regenerate replaces).
  // The sentence row is only written when generated this run — a reused
  // sentence's row already exists.
  const rows = [
    ...(succeeded.sentence ? [{ kind: "sentence", content: JSON.stringify({ text: sentence, translation }), storage_path: null, provider: keys.sentence.provider }] : []),
    ...(succeeded.image ? [{ kind: "image", content: null, storage_path: imagePath, provider: keys.image.provider }] : []),
    ...(succeeded.audio ? [{ kind: "audio", content: null, storage_path: audioPath, provider: keys.audio.provider }] : []),
  ].map((r) => ({ ...r, card_id: cardId, user_id: user.id, generation_id: generationId, prompt_used: promptUsed }));
  if (rows.length > 0) {
    const { error: mediaErr } = await admin.from("card_media").upsert(rows, { onConflict: "card_id,kind" });
    if (mediaErr) return { status: 500, body: { error: `persist failed: ${mediaErr.message}`, billed: false } };
  }

  // Debit only the attempted-and-succeeded kinds on the credit path
  const billedKinds = attempted.filter((k) => keys[k].ours && succeeded[k]);
  const cost = free ? 0 : runCost(billedKinds);
  const billed = cost > 0;
  if (billed) {
    await admin.from("credit_ledger").insert({
      user_id: user.id, delta: -cost, reason: `mnemonic generation (${billedKinds.join(", ")})`, generation_id: generationId,
    });
    balance -= cost;
  }

  return {
    status: 200,
    body: {
      generationId, sentence: { text: sentence, translation },
      imagePath, audioPath, failures, billed, cost, balance: free ? undefined : balance,
    },
  };
}
