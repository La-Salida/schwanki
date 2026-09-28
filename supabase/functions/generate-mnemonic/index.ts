import { createClient } from "@supabase/supabase-js";
import {
  buildSentencePrompt, parseSentenceResponse, buildImagePrompt,
  createSentenceProvider, createImageProvider, createTtsProvider,
  resolveKeys, isFreePath, shouldDebit,
  type Provider,
} from "@schwanki/mnemonic";
import type { MediaKind } from "@schwanki/core";
import { OUR_KEY_ENV, rateLimited, storagePath } from "./lib.ts";

Deno.serve(async (req) => {
  // User-facing write path: require a valid USER jwt (service role is rejected —
  // it would bypass per-user billing and RLS ownership).
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { cardId, hook } = await req.json() as { cardId?: string; hook?: string };
  if (!cardId) return Response.json({ error: "cardId required" }, { status: 400 });
  if (hook && hook.length > 500) return Response.json({ error: "hook too long" }, { status: 400 });

  // Load the card + verify ownership
  const { data: card } = await admin.from("cards").select("*").eq("id", cardId).eq("user_id", user.id).single();
  if (!card) return Response.json({ error: "card_not_found" }, { status: 404 });

  // Rate limit: count this user's media rows in the last hour
  const { count } = await admin.from("card_media")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("created_at", new Date(Date.now() - 3600_000).toISOString());
  if (rateLimited(count ?? 0)) return Response.json({ error: "rate_limited" }, { status: 429 });

  // Key resolution: user's BYOK keys first (write-only table — service role reads)
  const { data: keyRows } = await admin.from("user_api_keys").select("provider, api_key").eq("user_id", user.id);
  const userKeys = Object.fromEntries((keyRows ?? []).map((r) => [r.provider as Provider, r.api_key as string]));
  const keys = resolveKeys(userKeys);
  const free = isFreePath(keys);

  // Credit path: fill our key slots from env, check balance BEFORE any provider call
  let balance = 0;
  if (!free) {
    for (const kind of ["sentence", "image", "audio"] as MediaKind[]) {
      if (keys[kind].ours) keys[kind].apiKey = Deno.env.get(OUR_KEY_ENV[keys[kind].provider]) ?? "";
    }
    const { data: ledger } = await admin.from("credit_ledger").select("delta").eq("user_id", user.id);
    balance = (ledger ?? []).reduce((n, r) => n + (r.delta as number), 0);
    if (balance < 1) return Response.json({ error: "no_credits", balance }, { status: 402 });
    for (const kind of ["sentence", "image", "audio"] as MediaKind[]) {
      if (keys[kind].ours && !keys[kind].apiKey) {
        return Response.json({ error: `server missing key for ${keys[kind].provider}` }, { status: 500 });
      }
    }
  }

  const generationId = crypto.randomUUID();
  const promptUsed = hook?.trim() || null;
  const failures: MediaKind[] = [];
  const succeeded = { sentence: false, image: false, audio: false };

  // 1. Sentence (hard dependency for image prompt — if this fails, abort)
  let sentence = "", translation = "";
  try {
    const raw = await createSentenceProvider(keys.sentence.provider, keys.sentence.apiKey)
      .generateSentence(buildSentencePrompt({
        id: card.id, userId: card.user_id, sourceId: card.source_id, language: card.language,
        front: card.front, back: card.back, reading: card.reading ?? undefined,
        exampleSentence: card.example_sentence ?? undefined, createdAt: card.created_at,
      }, hook));
    ({ sentence, translation } = parseSentenceResponse(raw));
    succeeded.sentence = true;
  } catch (e) {
    // NEVER fall back to our keys on a user-key failure (would silently bill)
    return Response.json({ error: `sentence failed: ${(e as Error).message}`, failures: ["sentence", "image", "audio"], billed: false }, { status: 502 });
  }

  // 2. Image + 3. Audio (independent — partial success allowed)
  let imagePath: string | undefined, audioPath: string | undefined;
  try {
    const bytes = await createImageProvider(keys.image.provider, keys.image.apiKey)
      .generateImage(buildImagePrompt(sentence, translation));
    imagePath = storagePath(user.id, cardId, generationId, "image");
    const up = await admin.storage.from("card-media").upload(imagePath, bytes, { contentType: "image/png" });
    if (up.error) throw new Error(up.error.message);
    succeeded.image = true;
  } catch (e) {
    console.error("image failed", e);
    failures.push("image"); imagePath = undefined;
  }
  try {
    const bytes = await createTtsProvider(keys.audio.provider, keys.audio.apiKey)
      .generateSpeech(sentence, card.language);
    audioPath = storagePath(user.id, cardId, generationId, "audio");
    const up = await admin.storage.from("card-media").upload(audioPath, bytes, { contentType: "audio/mpeg" });
    if (up.error) throw new Error(up.error.message);
    succeeded.audio = true;
  } catch (e) {
    console.error("audio failed", e);
    failures.push("audio"); audioPath = undefined;
  }

  // Persist rows (upsert per (card_id, kind) so regenerate replaces)
  const rows = [
    { kind: "sentence", content: JSON.stringify({ text: sentence, translation }), storage_path: null, provider: keys.sentence.provider },
    ...(succeeded.image ? [{ kind: "image", content: null, storage_path: imagePath, provider: keys.image.provider }] : []),
    ...(succeeded.audio ? [{ kind: "audio", content: null, storage_path: audioPath, provider: keys.audio.provider }] : []),
  ].map((r) => ({ ...r, card_id: cardId, user_id: user.id, generation_id: generationId, prompt_used: promptUsed }));
  const { error: mediaErr } = await admin.from("card_media").upsert(rows, { onConflict: "card_id,kind" });
  if (mediaErr) return Response.json({ error: `persist failed: ${mediaErr.message}`, billed: false }, { status: 500 });

  // Debit ONLY on full success on the credit path
  const billed = !free && shouldDebit(succeeded);
  if (billed) {
    await admin.from("credit_ledger").insert({
      user_id: user.id, delta: -1, reason: "mnemonic generation", generation_id: generationId,
    });
    balance -= 1;
  }

  return Response.json({
    generationId, sentence: { text: sentence, translation },
    imagePath, audioPath, failures, billed, balance: free ? undefined : balance,
  });
});
