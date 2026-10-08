import { createClient } from "@supabase/supabase-js";
import { corsJson, corsPreflight } from "../_shared/cors.ts";
import { runGeneration } from "./pipeline.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  // User-facing write path: require a valid USER jwt (service role is rejected —
  // it would bypass per-user billing and RLS ownership).
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return corsJson({ error: "unauthorized" }, 401);
  }
  const params = await req.json().catch(() => ({}));
  const outcome = await runGeneration(user, params);
  return corsJson(outcome.body, outcome.status);
});
