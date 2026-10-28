import { createClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../_shared/cors.ts";
import { requeueFailedParses, startParsingNow } from "../_shared/requeue.ts";
import { cleanText } from "../_shared/text.ts";
import { addedLines } from "../sync-google/diff.ts";
import { extractSourceText } from "./pdf.ts";
import { isImageType, transcribeImage } from "./vision.ts";

const BUCKET = "source-files";

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

class SyncError extends Error {
  constructor(public kind: "revoked" | "error", message: string) { super(message); }
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", typeof data === "string" ? new TextEncoder().encode(data) : data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function downloadFile(source: Record<string, unknown>): Promise<Blob> {
  const supabase = adminClient();
  const path = `${source.user_id}/${source.id}.pdf`;
  const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !file) throw new SyncError("error", `storage download failed: ${error?.message ?? "empty"}`);
  return file;
}

/** Pictures are read by a vision model, which costs money and words a re-read slightly
 *  differently each time. So their content_hash is the hash of the picture itself: a
 *  picture is read once, and again only when "Update file" replaces it. */
async function readPicture(source: Record<string, unknown>, file: Blob): Promise<{ content: string | null; hash: string }> {
  const hash = await sha256(await file.arrayBuffer());
  if (hash === source.content_hash) return { content: null, hash };
  let text: string;
  try {
    text = cleanText(await transcribeImage(file, String(source.language), {
      apiKey: Deno.env.get("FAL_KEY") ?? Deno.env.get("FAL_API_KEY") ?? "",
      model: Deno.env.get("VISION_MODEL"),
    }));
  } catch (e) {
    throw new SyncError("error", `couldn't read this picture: ${(e as Error).message}`);
  }
  if (!text.trim()) throw new SyncError("error", "no lesson writing found in this picture");
  return { content: text, hash };
}

async function extractContent(file: Blob): Promise<string> {
  let text: string;
  try {
    text = cleanText(await extractSourceText(file));
  } catch (e) {
    throw new SyncError("error", `document extraction failed: ${(e as Error).message}`);
  }
  if (!text.trim()) {
    throw new SyncError("error", "no extractable text — this PDF looks scanned or image-only. Upload screenshots or photos of its pages instead");
  }
  return text;
}

async function syncOne(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const file = await downloadFile(source);
  const picture = isImageType(file.type) ? await readPicture(source, file) : null;
  const content = picture ? picture.content : await extractContent(file);
  const hash = picture ? picture.hash : await sha256(content!);
  const requeued = await requeueFailedParses(supabase, source.id as string);
  if (content === null || hash === source.content_hash) {
    await supabase.from("sources")
      .update({ last_synced_at: new Date().toISOString(), status: "active", error_detail: null, sync_started_at: null })
      .eq("id", source.id);
    if (requeued > 0) { startParsingNow(); return `requeued:${requeued}`; }
    return "unchanged";
  }

  const { data: snap } = await supabase
    .from("source_snapshots").select("content")
    .eq("source_id", source.id).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  const added = addedLines(snap?.content ?? null, content);

  if (added.length > 0) {
    const { error: jobError } = await supabase.from("llm_jobs").insert({
      type: "parse",
      payload: { source_id: source.id, chunk: added.join("\n") },
    });
    // Abort before advancing the snapshot/hash so the added lines are re-diffed next sync.
    if (jobError) throw new SyncError("error", `llm_jobs insert failed: ${jobError.message}`);
  }
  const { error: snapError } = await supabase.from("source_snapshots").insert({ source_id: source.id, content });
  if (snapError) throw new SyncError("error", `snapshot insert failed: ${snapError.message}`);
  const { error: srcError } = await supabase.from("sources").update({
    last_synced_at: new Date().toISOString(), content_hash: hash, status: "active", error_detail: null, sync_started_at: null,
  }).eq("id", source.id);
  // Snapshot is already written; a failed hash update self-heals on the next sync.
  if (srcError) console.warn(`sources hash update failed for ${source.id}: ${srcError.message}`);
  if (added.length > 0 || requeued > 0) startParsingNow();
  return `diffed:${added.length}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const supabase = adminClient();
  const body = await req.json().catch(() => ({})) as { sourceId?: string };

  let query = supabase.from("sources").select("*").eq("type", "pdf_upload");

  if (body.sourceId) {
    // Manual "sync now": verify the caller owns this source
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return corsJson({ error: "unauthorized" }, 401);
    query = query.eq("id", body.sourceId).eq("user_id", user.id);
  } else if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    // Cron path: service-role bearer only
    return corsJson({ error: "unauthorized" }, 401);
  } else {
    // Cron: retry transient failures automatically; pdf sources are never "revoked" (no OAuth)
    query = query.in("status", ["active", "error"]);
  }

  const { data: sources } = await query;
  const results: Record<string, string> = {};
  for (const source of sources ?? []) {
    // Lets the class notes row show this sync while it runs, scheduled or pressed.
    await supabase.from("sources").update({ sync_started_at: new Date().toISOString() }).eq("id", source.id);
    try {
      results[source.id] = await syncOne(source);
    } catch (e) {
      // Failure isolation: mark this source, keep going
      const err = e as Error & { kind?: string };
      await supabase.from("sources").update({
        status: err.kind === "revoked" ? "revoked" : "error",
        error_detail: err.message,
        sync_started_at: null,
      }).eq("id", source.id);
      results[source.id] = `failed:${err.message}`;
    }
  }
  if (body.sourceId && !results[body.sourceId]) {
    results[body.sourceId] = "failed:This source no longer exists. Refresh the page.";
  }
  return corsJson({ results });
});
