import { createClient } from "@supabase/supabase-js";
import { MODEL_LIST_ENDPOINT, parseModelList, type Provider } from "@schwanki/mnemonic";

/** Model catalogs, live from each provider's listing endpoint. User-JWT only
 *  (the service role must never call this): keys are read server-side from the
 *  write-only user_api_keys table and never leave this function. Read-only and
 *  cheap — no rate limit, no billing. */
Deno.serve(async (req) => {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user || jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: keyRows } = await admin.from("user_api_keys").select("provider, api_key").eq("user_id", user.id);

  const catalog: Record<string, ReturnType<typeof parseModelList>> = {};
  const failed: Record<string, string> = {};

  await Promise.allSettled((keyRows ?? []).map(async (row) => {
    const provider = row.provider as Provider;
    const endpoint = MODEL_LIST_ENDPOINT[provider];
    if (!endpoint) return; // fish / fal / higgsfield: curated-fallback providers, no listing API
    try {
      const res = await fetch(endpoint.url, {
        headers: endpoint.headers(row.api_key as string),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog[provider] = parseModelList(provider, await res.json());
    } catch (e) {
      failed[provider] = (e as Error).message; // one provider failing never blocks the others
    }
  }));

  return Response.json({ catalog, failed });
});
