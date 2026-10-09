import { createClient } from "@supabase/supabase-js";
import { createTeacherPhotoHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(createTeacherPhotoHandler({
  authenticate: async jwt => {
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    return error ? null : user?.id ?? null;
  },
  fetchProfile: async profileUrl => {
    const response = await fetch(profileUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Schwanki teacher photo)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`profile ${response.status}`);
    // The og:image tag sits in <head>; cap the read so a huge page can't exhaust the worker.
    return (await response.text()).slice(0, 2_000_000);
  },
  save: async ({ userId, jwt, name, preplyUrl, photoUrl }) => {
    // The user's JWT keeps the write under RLS.
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { error } = await db.from("teachers").upsert(
      { user_id: userId, name, preply_url: preplyUrl, photo_url: photoUrl, updated_at: new Date().toISOString() },
      { onConflict: "user_id,name_key" },
    );
    if (error) throw error;
  },
}));
