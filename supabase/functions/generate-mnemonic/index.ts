import { createClient } from "@supabase/supabase-js";
import { runGeneration } from "./pipeline.ts";

Deno.serve(async (req) => {
  // User-facing write path: require a valid USER jwt (service role is rejected —
  // it would bypass per-user billing and RLS ownership).
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = await req.json().catch(() => ({}));
  const outcome = await runGeneration(user, params);
  return Response.json(outcome.body, { status: outcome.status });
});
