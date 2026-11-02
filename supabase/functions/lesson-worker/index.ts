import { createClient } from "@supabase/supabase-js";
import { serve } from "../_shared/monitoring.ts";
import { startParsingNow } from "../_shared/requeue.ts";
import { segmentWords, transcriptText, type Channel, type ScribeWord, type Segment } from "../_shared/lesson.ts";

const BUCKET = "lesson-audio";
const PROVIDER = "elevenlabs";
const MODEL = Deno.env.get("LESSON_STT_MODEL") ?? "scribe_v2";

// deno-lint-ignore no-explicit-any
type Admin = any;
interface PartRow { recording_id: string; user_id: string; channel: Channel; part: number; start_ms: number; duration_ms: number; storage_path: string; attempts: number }

/** Service-only (verify_jwt). Runs every 2 minutes and right after a lesson is submitted:
 *  transcribes waiting parts, then turns each fully transcribed lesson into a parse job. */
serve("lesson-worker", async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return Response.json({ error: "ELEVENLABS_API_KEY is not set." }, { status: 500 });

  const { data: parts, error } = await admin.rpc("claim_lesson_parts", { batch_size: 4 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = await Promise.all(((parts ?? []) as PartRow[]).map((p) => transcribePart(admin, apiKey, p)));
  const finished = await finalizeReady(admin);
  const expired = await removeExpiredAudio(admin);
  return Response.json({ transcribed: results, finished, expired });
});

async function transcribePart(admin: Admin, apiKey: string, part: PartRow): Promise<string> {
  const key = { recording_id: part.recording_id, channel: part.channel, part: part.part, sequence: 0 };
  try {
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(part.storage_path, 900);
    if (error || !signed?.signedUrl) throw new Error(`signed url: ${error?.message ?? "missing"}`);
    const form = new FormData();
    form.append("model_id", MODEL);
    form.append("cloud_storage_url", signed.signedUrl);
    form.append("timestamps_granularity", "word");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": apiKey }, body: form,
    });
    if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const result = await response.json() as { words?: ScribeWord[] };
    const segments = segmentWords(result.words ?? [], part.channel, part.start_ms);
    const { error: saveErr } = await admin.from("class_recording_chunks")
      .update({ segments, transcribed_at: new Date().toISOString(), last_error: null }).match(key);
    if (saveErr) throw saveErr;
    return `${part.storage_path}:${segments.length}`;
  } catch (e) {
    const message = (e as Error).message;
    console.error(`lesson part ${part.storage_path} failed (attempt ${part.attempts}): ${message}`);
    await admin.from("class_recording_chunks").update({ last_error: message, claimed_at: null }).match(key);
    if (part.attempts >= 3) await failRecording(admin, part.recording_id, "We couldn't transcribe this lesson. Your credits were refunded.");
    return `${part.storage_path}:error`;
  }
}

/** Lessons whose every part is transcribed become one transcript and one parse job. */
async function finalizeReady(admin: Admin): Promise<string[]> {
  const { data: waiting, error } = await admin.from("class_recordings").select("id").eq("status", "transcribing").limit(20);
  if (error) throw error;
  const done: string[] = [];
  for (const { id } of (waiting ?? []) as Array<{ id: string }>) {
    const { data: chunks, error: chunkErr } = await admin.from("class_recording_chunks")
      .select("transcribed_at, segments, storage_path").eq("recording_id", id);
    if (chunkErr) throw chunkErr;
    if (!chunks?.length || chunks.some((c: { transcribed_at: string | null }) => !c.transcribed_at)) continue;
    // Claim the lesson so a second worker run doesn't finalize it twice.
    const { data: claimed } = await admin.from("class_recordings").update({ status: "extracting" })
      .eq("id", id).eq("status", "transcribing").select("id, user_id, source_id, duration_ms").maybeSingle();
    if (!claimed) continue;
    try {
      const segments = chunks.flatMap((c: { segments: Segment[] | null }) => c.segments ?? []) as Segment[];
      if (segments.length === 0) {
        await failRecording(admin, id, "No speech was heard in this recording. Your credits were refunded.");
        continue;
      }
      await saveTranscript(admin, claimed, segments);
      const { error: jobErr } = await admin.from("llm_jobs").insert({
        type: "parse", payload: { source_id: claimed.source_id, chunk: transcriptText(segments), recording_id: id },
      });
      if (jobErr) throw jobErr;
      // The transcript is saved, so the raw audio is no longer needed.
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(chunks.map((c: { storage_path: string }) => c.storage_path));
      if (rmErr) console.warn(`lesson ${id}: audio cleanup failed: ${rmErr.message}`);
      await admin.from("class_recordings").update({ status: "ready", retention_until: new Date().toISOString() }).eq("id", id);
      done.push(id);
    } catch (e) {
      console.error(`lesson ${id} finalize failed: ${(e as Error).message}`);
      await admin.from("class_recordings").update({ status: "transcribing" }).eq("id", id).eq("status", "extracting");
    }
  }
  if (done.length > 0) startParsingNow();
  return done;
}

async function saveTranscript(admin: Admin, rec: { id: string; user_id: string; duration_ms: number }, segments: Segment[]) {
  const existing = await admin.from("class_transcripts").select("id").eq("recording_id", rec.id).eq("revision", 1).maybeSingle();
  if (existing.error) throw existing.error;
  let transcriptId = existing.data?.id as string | undefined;
  if (!transcriptId) {
    const { data, error } = await admin.from("class_transcripts").insert({
      recording_id: rec.id, user_id: rec.user_id, revision: 1, provider: PROVIDER, model: MODEL,
      usage: { audio_ms: rec.duration_ms },
    }).select("id").single();
    if (error) throw error;
    transcriptId = data.id as string;
    const ordered = [...segments].sort((a, b) => a.startMs - b.startMs);
    const { error: segErr } = await admin.from("class_transcript_segments").insert(ordered.map((s, i) => ({
      transcript_id: transcriptId, recording_id: rec.id, user_id: rec.user_id, ordinal: i,
      channel: s.channel, start_ms: s.startMs, end_ms: Math.max(s.endMs, s.startMs), speaker: s.channel === "tab" ? "Tutor" : "You", text: s.text,
    })));
    if (segErr) throw segErr;
  }
  const { error } = await admin.from("class_recordings").update({ current_transcript_id: transcriptId }).eq("id", rec.id);
  if (error) throw error;
}

/** Marks the lesson failed and gives back what it was charged. */
async function failRecording(admin: Admin, recordingId: string, message: string) {
  const { data: rec } = await admin.from("class_recordings").update({ status: "failed", failure_stage: "transcribing", error_detail: message })
    .eq("id", recordingId).in("status", ["transcribing", "extracting"]).select("user_id").maybeSingle();
  if (!rec) return;
  const { data: charge } = await admin.from("credit_ledger").select("delta")
    .eq("user_id", rec.user_id).eq("feature", "lesson").eq("usage_key", recordingId).maybeSingle();
  // A free lesson gets a zero refund row too, so the user keeps their free first lesson.
  if (charge && charge.delta <= 0) {
    await admin.from("credit_ledger").insert({
      user_id: rec.user_id, delta: -charge.delta, feature: "lesson_refund", usage_key: recordingId, reason: "Refund: recorded lesson couldn't be transcribed",
    });
  }
}

/** Audio that never got transcribed (failed, or uploaded but never submitted) is kept 7 days for a retry, then deleted. */
async function removeExpiredAudio(admin: Admin): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: stale, error } = await admin.from("class_recordings").select("id")
    .in("status", ["failed", "uploading"]).lt("created_at", cutoff).is("deleted_at", null).limit(20);
  if (error) throw error;
  for (const { id } of (stale ?? []) as Array<{ id: string }>) {
    const { data: chunks } = await admin.from("class_recording_chunks").select("storage_path").eq("recording_id", id);
    const paths = (chunks ?? []).map((c: { storage_path: string }) => c.storage_path);
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr) { console.warn(`lesson ${id}: expired audio cleanup failed: ${rmErr.message}`); continue; }
    }
    await admin.from("class_recordings").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  }
  return stale?.length ?? 0;
}
