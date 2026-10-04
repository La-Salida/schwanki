import { createClient } from "@supabase/supabase-js";
import { addedLines } from "../sync-google/diff.ts";
import { extractPdfText } from "./pdf.ts";

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

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchContent(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const path = `${source.user_id}/${source.id}.pdf`;
  const { data: file, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !file) throw new SyncError("error", `storage download failed: ${error?.message ?? "empty"}`);
  let text: string;
  try {
    text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    throw new SyncError("error", `pdf extraction failed: ${(e as Error).message}`);
  }
  if (!text.trim()) {
    throw new SyncError("error", "no extractable text — this PDF looks scanned or image-only");
  }
  return text;
}

async function syncOne(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const content = await fetchContent(source);
  const hash = await sha256(content);
  if (hash === source.content_hash) {
    await supabase.from("sources")
      .update({ last_synced_at: new Date().toISOString(), status: "active", error_detail: null })
      .eq("id", source.id);
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
    last_synced_at: new Date().toISOString(), content_hash: hash, status: "active", error_detail: null,
  }).eq("id", source.id);
  // Snapshot is already written; a failed hash update self-heals on the next sync.
  if (srcError) console.warn(`sources hash update failed for ${source.id}: ${srcError.message}`);
  return `diffed:${added.length}`;
}

Deno.serve(async (req) => {
  const supabase = adminClient();
  const body = await req.json().catch(() => ({})) as { sourceId?: string };

  let query = supabase.from("sources").select("*")
    // Retry transient failures automatically; pdf sources are never "revoked" (no OAuth)
    .eq("type", "pdf_upload").in("status", ["active", "error"]);

  if (body.sourceId) {
    // Manual "sync now": verify the caller owns this source
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    query = query.eq("id", body.sourceId).eq("user_id", user.id);
  } else if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    // Cron path: service-role bearer only
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: sources } = await query;
  const results: Record<string, string> = {};
  for (const source of sources ?? []) {
    try {
      results[source.id] = await syncOne(source);
    } catch (e) {
      // Failure isolation: mark this source, keep going
      const err = e as Error & { kind?: string };
      await supabase.from("sources").update({
        status: err.kind === "revoked" ? "revoked" : "error",
        error_detail: err.message,
      }).eq("id", source.id);
      results[source.id] = `failed:${err.message}`;
    }
  }
  return Response.json({ results });
});
