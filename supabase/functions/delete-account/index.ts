import { createClient } from "@supabase/supabase-js";
import { createDeleteAccountHandler, filesUnder } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BUCKETS = ["card-media", "source-files"];

Deno.serve(createDeleteAccountHandler({
  authenticate: async jwt => {
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    return error ? null : user?.id ?? null;
  },
  revokeGoogle: async userId => {
    const { data } = await admin.from("user_google_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
    if (!data?.refresh_token) return;
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: data.refresh_token }),
      signal: AbortSignal.timeout(10_000),
    });
  },
  removeFiles: async userId => {
    for (const bucket of BUCKETS) {
      const store = admin.storage.from(bucket);
      const paths = await filesUnder(userId, async (path, offset) => {
        const { data, error } = await store.list(path, { limit: 1000, offset });
        if (error) throw error;
        return data ?? [];
      });
      for (let i = 0; i < paths.length; i += 1000) {
        const { error } = await store.remove(paths.slice(i, i + 1000));
        if (error) throw error;
      }
    }
  },
  deleteUser: async userId => {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
}));
