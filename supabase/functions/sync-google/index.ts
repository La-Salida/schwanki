import { createClient } from "@supabase/supabase-js";
import { addedLines, extractGoogleFileId } from "./diff.ts";
import { classifyHttpError } from "./classify.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_EXPORT = (fileId: string, mime: string) =>
  `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function googleAccessToken(refreshToken: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch (e) {
    // Network-level failure is transient, not a revocation
    throw new SyncError("error", `google token refresh network error: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new SyncError(
      classifyHttpError(res.status),
      `google token refresh failed: ${res.status}`,
    );
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

class SyncError extends Error {
  constructor(public kind: "revoked" | "error", message: string) { super(message); }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchContent(fileId: string, type: string, token: string): Promise<string> {
  const mime = type === "google_sheet" ? "text/csv" : "text/plain";
  let res: Response;
  try {
    res = await fetch(DRIVE_EXPORT(fileId, mime), {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new SyncError("error", `drive export network error: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new SyncError(classifyHttpError(res.status), `drive export ${res.status}`);
  }
  return res.text();
}

async function syncOne(source: Record<string, unknown>): Promise<string> {
  const supabase = adminClient();
  const fileId = extractGoogleFileId(source.external_ref as string);
  if (!fileId) throw new SyncError("error", "unparseable external_ref");

  const { data: tok } = await supabase
    .from("user_google_tokens").select("refresh_token")
    .eq("user_id", source.user_id).single();
  if (!tok) throw new SyncError("revoked", "no google refresh token stored");

  const access = await googleAccessToken(tok.refresh_token);
  const content = await fetchContent(fileId, source.type as string, access);
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
    // supabase-js does not throw on error; abort before advancing the
    // snapshot/hash so the added lines are re-diffed on the next sync.
    if (jobError) throw new SyncError("error", `llm_jobs insert failed: ${jobError.message}`);
  }
  // M3: a failed snapshot insert with a successful hash update would desync the
  // diff baseline (new hash, old snapshot → next sync re-diffs everything or
  // misses lines). Abort before advancing the hash so the next sync retries.
  const { error: snapError } = await supabase.from("source_snapshots").insert({ source_id: source.id, content });
  if (snapError) throw new SyncError("error", `snapshot insert failed: ${snapError.message}`);
  const { error: srcError } = await supabase.from("sources").update({
    last_synced_at: new Date().toISOString(), content_hash: hash, status: "active", error_detail: null,
  }).eq("id", source.id);
  // Snapshot is already written; a failed hash update self-heals on the next sync
  // (hash mismatch → diff against the fresh snapshot → 0 added lines → hash updated).
  if (srcError) console.warn(`sources hash update failed for ${source.id}: ${srcError.message}`);
  return `diffed:${added.length}`;
}

Deno.serve(async (req) => {
  const supabase = adminClient();
  const body = await req.json().catch(() => ({})) as { sourceId?: string };

  let query = supabase.from("sources").select("*")
    // Retry transient failures automatically; revoked sources stay parked (need re-auth)
    .in("type", ["google_sheet", "google_doc"]).in("status", ["active", "error"]);

  if (body.sourceId) {
    // Manual "sync now": verify the caller owns this source (§10 never silent, never cross-user)
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    query = query.eq("id", body.sourceId).eq("user_id", user.id);
  } else if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    // Cron path (full sync of all active sources): service-role bearer only —
    // the anon key must not be able to trigger a full sync.
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: sources } = await query;
  const results: Record<string, string> = {};
  for (const source of sources ?? []) {
    try {
      results[source.id] = await syncOne(source);
    } catch (e) {
      // Failure isolation (§6.3): mark this source, keep going
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
