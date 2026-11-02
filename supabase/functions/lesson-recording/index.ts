import { createClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../_shared/cors.ts";
import { serve } from "../_shared/monitoring.ts";
import { checkParts, lessonCost, MAX_LESSON_MS, partPath, type PartInput } from "../_shared/lesson.ts";

const BUCKET = "lesson-audio";
const LABEL = "Recorded lessons";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGUAGE = /^[a-z]{2,3}$/;

/** Recorded lessons from the Chrome extension. User-JWT only.
 *  { action: "link" }                                   → a one-time sign-in token for the extension (called by the web app)
 *  { action: "create", clientKey, language, startedAt, durationMs, parts } → recording id and where to upload each part
 *  { action: "submit", recordingId }                    → charges credits and queues transcription
 *  { action: "status", recordingIds }                   → processing state of the user's recordings */
serve("lesson-recording", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return corsJson({ error: "method not allowed" }, 405);
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!jwt || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return corsJson({ error: "unauthorized" }, 401);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return corsJson({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === "link") {
    // The extension gets its own session from this token. Sharing the web app's refresh token
    // would make the two refresh the same token and sign the web app out.
    if (!user.email) return corsJson({ error: "The extension needs an account with an email address. Sign in with Google to use it." }, 400);
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (error || !data.properties?.hashed_token) return corsJson({ error: "Couldn't connect the extension. Try again." }, 500);
    return corsJson({ tokenHash: data.properties.hashed_token });
  }

  if (body.action === "create") {
    const { clientKey, language, startedAt, durationMs, parts } = body as {
      clientKey?: string; language?: string; startedAt?: string; durationMs?: number; parts?: PartInput[];
    };
    if (typeof clientKey !== "string" || !UUID.test(clientKey)) return corsJson({ error: "Bad recording id." }, 400);
    if (typeof language !== "string" || !LANGUAGE.test(language)) return corsJson({ error: "Pick the language you're learning." }, 400);
    if (typeof durationMs !== "number" || !(durationMs > 0) || durationMs > MAX_LESSON_MS) return corsJson({ error: "Recordings can be up to 2 hours." }, 400);
    const started = new Date(typeof startedAt === "string" ? startedAt : NaN);
    if (Number.isNaN(started.getTime())) return corsJson({ error: "Bad start time." }, 400);
    const problem = checkParts(parts);
    if (problem) return corsJson({ error: problem }, 400);

    const existing = await admin.from("class_recordings").select("id, status, deleted_at")
      .eq("user_id", user.id).eq("client_key", clientKey).maybeSingle();
    if (existing.error) throw existing.error;
    let recordingId = existing.data?.id as string | undefined;
    if (!recordingId) {
      const sourceId = await lessonSource(admin, user.id, language);
      const { data, error } = await admin.from("class_recordings").insert({
        user_id: user.id, source_id: sourceId, client_key: clientKey,
        label: `Lesson, ${started.toISOString().slice(0, 10)}`,
        target_language: language, explanation_language: "en", status: "uploading",
        started_at: started.toISOString(), ended_at: new Date(started.getTime() + durationMs).toISOString(),
        duration_ms: Math.round(durationMs), limits: { maxMs: MAX_LESSON_MS }, quote_expires_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      recordingId = data.id as string;
      const { error: partsError } = await admin.from("class_recording_chunks").insert(parts!.map((p) => ({
        recording_id: recordingId, user_id: user.id, channel: p.channel, part: p.part, sequence: 0,
        start_ms: Math.round(p.startMs), duration_ms: Math.round(p.durationMs), bytes: p.bytes, checksum: p.checksum,
        mime_type: p.mimeType, storage_path: partPath(user.id, recordingId!, p.channel, p.part),
      })));
      if (partsError) throw partsError;
    } else if (existing.data!.status !== "uploading") {
      return corsJson({ recordingId, status: existing.data!.status, uploads: [] });
    } else if (existing.data!.deleted_at) {
      // Its server copy expired while it waited for credits; the extension still has the audio.
      const { error } = await admin.from("class_recordings").update({ deleted_at: null, created_at: new Date().toISOString() }).eq("id", recordingId);
      if (error) throw error;
    }
    const { data: chunks, error } = await admin.from("class_recording_chunks")
      .select("channel, part, storage_path").eq("recording_id", recordingId);
    if (error) throw error;
    return corsJson({
      recordingId, status: "uploading",
      uploads: (chunks ?? []).map((c) => ({ channel: c.channel, part: c.part, path: c.storage_path })),
    });
  }

  if (body.action === "submit") {
    const recordingId = body.recordingId;
    if (typeof recordingId !== "string" || !UUID.test(recordingId)) return corsJson({ error: "Bad recording id." }, 400);
    const { data: rec, error } = await admin.from("class_recordings").select("id, status, duration_ms")
      .eq("id", recordingId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!rec) return corsJson({ error: "Recording not found." }, 404);
    if (rec.status !== "uploading") return corsJson({ status: rec.status });

    const { data: chunks, error: chunkErr } = await admin.from("class_recording_chunks")
      .select("storage_path, bytes").eq("recording_id", recordingId);
    if (chunkErr) throw chunkErr;
    const { data: files, error: listErr } = await admin.storage.from(BUCKET).list(`${user.id}/${recordingId}`, { limit: 200 });
    if (listErr) throw listErr;
    const uploaded = new Map((files ?? []).map((f) => [`${user.id}/${recordingId}/${f.name}`, f.metadata?.size as number | undefined]));
    const missing = (chunks ?? []).filter((c) => !uploaded.has(c.storage_path) || uploaded.get(c.storage_path) !== c.bytes);
    if (missing.length > 0) return corsJson({ error: "Some audio didn't finish uploading. Try again.", missing: missing.map((c) => c.storage_path) }, 409);

    const charge = await chargeLesson(admin, user.id, recordingId, rec.duration_ms as number);
    if (!charge.ok) {
      return corsJson({
        error: `This lesson needs ${charge.cost} credits and you have ${charge.balance}. Buy credits in Billing, then try again. The recording stays saved on this computer.`,
        code: "no_credits", cost: charge.cost, balance: charge.balance,
      }, 402);
    }
    const { error: updErr } = await admin.from("class_recordings").update({ status: "transcribing" })
      .eq("id", recordingId).eq("status", "uploading");
    if (updErr) throw updErr;
    kickWorker();
    return corsJson({ status: "transcribing", cost: charge.cost, free: charge.free });
  }

  if (body.action === "status") {
    const ids = Array.isArray(body.recordingIds) ? (body.recordingIds as unknown[]).filter((v): v is string => typeof v === "string" && UUID.test(v)).slice(0, 50) : [];
    if (ids.length === 0) return corsJson({ recordings: [] });
    const { data, error } = await admin.from("class_recordings").select("id, status, error_detail")
      .eq("user_id", user.id).in("id", ids);
    if (error) throw error;
    return corsJson({ recordings: data ?? [] });
  }

  return corsJson({ error: "unknown action" }, 400);
});

// deno-lint-ignore no-explicit-any
type Admin = any;

/** One "Recorded lessons" source per language, so the Inbox groups lessons by day under it. */
async function lessonSource(admin: Admin, userId: string, language: string): Promise<string> {
  const found = await admin.from("sources").select("id").eq("user_id", userId)
    .eq("type", "class_recording").eq("language", language).order("created_at").limit(1).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const { data, error } = await admin.from("sources").insert({
    user_id: userId, type: "class_recording", external_ref: "chrome-extension", label: LABEL, language, status: "active",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Charges once per recording: a retried submit finds the ledger row and is not charged again. */
async function chargeLesson(admin: Admin, userId: string, recordingId: string, durationMs: number) {
  const { data: rows, error } = await admin.from("credit_ledger").select("delta, feature, usage_key").eq("user_id", userId);
  if (error) throw error;
  const ledger = (rows ?? []) as Array<{ delta: number; feature: string | null; usage_key: string | null }>;
  const balance = ledger.reduce((n, r) => n + r.delta, 0);
  const refunded = new Set(ledger.filter((r) => r.feature === "lesson_refund").map((r) => r.usage_key));
  const prior = ledger.find((r) => r.feature === "lesson" && r.usage_key === recordingId);
  if (prior) return { ok: true, cost: -prior.delta, balance, free: false };
  // A lesson that failed and was refunded doesn't use up the free first lesson.
  const firstLesson = !ledger.some((r) => r.feature === "lesson" && !refunded.has(r.usage_key));
  const cost = lessonCost(durationMs, firstLesson);
  if (balance < cost) return { ok: false, cost, balance, free: false };
  const minutes = Math.ceil(durationMs / 60_000);
  const { error: insErr } = await admin.from("credit_ledger").insert({
    user_id: userId, delta: -cost, feature: "lesson", usage_key: recordingId,
    reason: firstLesson ? `Recorded lesson, ${minutes} min (first lesson free)` : `Recorded lesson, ${minutes} min`,
  });
  if (insErr) throw insErr;
  return { ok: true, cost, balance: balance - cost, free: firstLesson && cost === 0 };
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

function kickWorker(): void {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const run = fetch(`${url}/functions/v1/lesson-worker`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}",
  }).then((r) => r.body?.cancel()).catch((e) => console.warn(`lesson-worker kick failed: ${e}`));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run);
}
