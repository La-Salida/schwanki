import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../_shared/cors.ts";
import { serve } from "../_shared/monitoring.ts";
import { appReturn, authorizeUrl, CANVA_API, codeChallenge, designRef, randomToken, STATE_TTL_MS, summarizeDesign } from "./canva.ts";

// Routes (the last path segment):
//   POST start    → { url } to open in an auth sheet (signed-in caller)
//   GET  callback → Canva's redirect; stores tokens, then sends the person back to schwanki://canva/connected
//   POST designs  → { connected, designs, continuation } for a native list
//   POST import   → exports a design to PDF, stores it as a pdf_upload source → { sourceId }
//   POST disconnect
const BUCKET = "source-files";
const MAX_PDF = 10 * 1024 * 1024;

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const clientId = () => Deno.env.get("CANVA_CLIENT_ID") ?? "";
const clientSecret = () => Deno.env.get("CANVA_CLIENT_SECRET") ?? "";
const redirectUri = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1/canva-connect/callback`;
const NOT_READY = "Canva isn't connected to Schwanki yet. Use an exported PDF for now.";

class CanvaError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function caller(supabase: SupabaseClient, req: Request) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) throw new CanvaError("Sign in again, then try Canva.", 401);
  return user;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${CANVA_API}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${clientId()}:${clientSecret()}`)}`,
    },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new CanvaError(`Canva sign-in failed${json.error ? ` (${json.error})` : ""}. Connect Canva again.`, res.status >= 500 ? 502 : 401);
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString() };
}

async function saveTokens(supabase: SupabaseClient, userId: string, tokens: { access_token: string; refresh_token: string; expires_at: string }) {
  const { error } = await supabase.from("user_canva_tokens").upsert({ user_id: userId, ...tokens, updated_at: new Date().toISOString() });
  if (error) throw new CanvaError(`Couldn't save the Canva connection: ${error.message}`, 500);
}

/** A live access token, refreshed when it's within a minute of expiring. Null when Canva was never connected. */
async function accessToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("user_canva_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 60_000) return data.access_token;
  try {
    // Canva refresh tokens are single-use: the new pair replaces the old one.
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
    await saveTokens(supabase, userId, tokens);
    return tokens.access_token;
  } catch (e) {
    if ((e as CanvaError).status === 401) { await supabase.from("user_canva_tokens").delete().eq("user_id", userId); return null; }
    throw e;
  }
}

async function canva(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${CANVA_API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers } });
  // deno-lint-ignore no-explicit-any
  const json = await res.json().catch(() => ({})) as any;
  if (!res.ok) throw new CanvaError(json?.message ?? `Canva answered ${res.status}. Try again.`, res.status === 401 || res.status === 403 ? 401 : 502);
  return json;
}

async function start(supabase: SupabaseClient, req: Request) {
  if (!clientId() || !clientSecret()) throw new CanvaError(NOT_READY, 503);
  const user = await caller(supabase, req);
  await supabase.from("canva_oauth_states").delete().lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
  const state = randomToken(24), verifier = randomToken(64);
  const { error } = await supabase.from("canva_oauth_states").insert({ state, user_id: user.id, code_verifier: verifier });
  if (error) throw new CanvaError(`Couldn't start Canva sign-in: ${error.message}`, 500);
  return corsJson({ url: authorizeUrl(clientId(), redirectUri(), state, await codeChallenge(verifier)) });
}

async function callback(supabase: SupabaseClient, url: URL) {
  const back = (error?: string) => Response.redirect(appReturn(error), 302);
  const state = url.searchParams.get("state"), code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return back(url.searchParams.get("error_description") ?? "Canva access wasn't granted.");
  if (!state || !code) return back("Canva didn't finish signing in. Try again.");
  const { data: pending } = await supabase.from("canva_oauth_states").delete().eq("state", state).select().maybeSingle();
  if (!pending || Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS) return back("That Canva sign-in expired. Try again.");
  try {
    const tokens = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: pending.code_verifier, redirect_uri: redirectUri() });
    await saveTokens(supabase, pending.user_id, tokens);
  } catch (e) { return back((e as Error).message); }
  return back();
}

async function designs(supabase: SupabaseClient, req: Request) {
  const user = await caller(supabase, req);
  const { query, continuation } = await req.json().catch(() => ({})) as { query?: string; continuation?: string };
  const token = await accessToken(supabase, user.id);
  if (!token) return corsJson({ connected: false, designs: [], continuation: null });
  const params = new URLSearchParams({ ownership: "any", sort_by: "modified_descending", limit: "30" });
  if (query?.trim()) params.set("query", query.trim().slice(0, 255));
  if (continuation) params.set("continuation", continuation);
  const page = await canva(token, `/designs?${params}`);
  // deno-lint-ignore no-explicit-any
  return corsJson({ connected: true, designs: (page.items ?? []).map((item: any) => summarizeDesign(item)), continuation: page.continuation ?? null });
}

async function exportPdf(token: string, designId: string): Promise<Uint8Array> {
  let job = (await canva(token, "/exports", { method: "POST", body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }) })).job;
  for (let i = 0; job?.status === "in_progress" && i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    job = (await canva(token, `/exports/${job.id}`)).job;
  }
  if (job?.status !== "success" || !job.urls?.[0]) throw new CanvaError(job?.error?.message ?? "Canva couldn't export this design as a PDF. Try again.", 502);
  const file = await fetch(job.urls[0]);
  if (!file.ok) throw new CanvaError("Downloading the PDF from Canva failed. Try again.", 502);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_PDF) throw new CanvaError("This design's PDF is over 10 MB. Split it into smaller designs.", 413);
  return bytes;
}

async function importDesign(supabase: SupabaseClient, req: Request) {
  const user = await caller(supabase, req);
  const { designId, language, label } = await req.json().catch(() => ({})) as { designId?: string; language?: string; label?: string };
  if (!designId || !/^[A-Za-z0-9_-]{1,64}$/.test(designId) || !language) throw new CanvaError("Choose a design and a language first.");
  const token = await accessToken(supabase, user.id);
  if (!token) throw new CanvaError("Connect Canva again, then choose your design.", 401);
  const design = summarizeDesign((await canva(token, `/designs/${designId}`)).design ?? { id: designId });
  const ref = designRef(design);
  const pdf = await exportPdf(token, designId);
  const { data: existing } = await supabase.from("sources").select("id").eq("user_id", user.id).eq("type", "pdf_upload").eq("external_ref", ref).maybeSingle();
  let sourceId = existing?.id as string | undefined;
  if (!sourceId) {
    const { data: created, error } = await supabase.from("sources")
      .insert({ user_id: user.id, type: "pdf_upload", external_ref: ref, label: (label?.trim() || design.title).slice(0, 150), language })
      .select("id").single();
    if (error || !created) throw new CanvaError(`Couldn't save the design: ${error?.message ?? "no row"}`, 500);
    sourceId = created.id;
  }
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(`${user.id}/${sourceId}.pdf`, pdf, { upsert: true, contentType: "application/pdf" });
  if (uploadError) throw new CanvaError(`Couldn't store the PDF: ${uploadError.message}`, 500);
  return corsJson({ sourceId, title: design.title });
}

serve("canva-connect", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const url = new URL(req.url);
  const route = url.pathname.split("/").filter(Boolean).pop();
  const supabase = admin();
  try {
    if (route === "callback" && req.method === "GET") return await callback(supabase, url);
    if (req.method !== "POST") return corsJson({ error: "not found" }, 404);
    if (route === "start") return await start(supabase, req);
    if (route === "designs") return await designs(supabase, req);
    if (route === "import") return await importDesign(supabase, req);
    if (route === "disconnect") {
      const user = await caller(supabase, req);
      await supabase.from("user_canva_tokens").delete().eq("user_id", user.id);
      return corsJson({ ok: true });
    }
    return corsJson({ error: "not found" }, 404);
  } catch (e) {
    const err = e as CanvaError;
    return corsJson({ error: err.message }, err.status ?? 500);
  }
});
