import { supabase } from "./supabase";

export const GOOGLE_OAUTH_OPTIONS = {
  provider: "google" as const,
  options: {
    scopes: "openid email profile https://www.googleapis.com/auth/drive.readonly",
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo: window.location.origin + import.meta.env.BASE_URL,
  },
};

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth(GOOGLE_OAUTH_OPTIONS);
  if (error) throw error;
}

/** Right after OAuth redirect, stash the Google refresh token for server-side sync (§6.1). */
export async function captureGoogleTokens(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const refresh = session?.provider_refresh_token;
  const userId = session?.user.id;
  if (!refresh || !userId) {
    console.warn("[schwanki] no provider_refresh_token in session", { hasSession: !!session, hasRefresh: !!refresh });
    return false;
  }
  // NOTE: PostgREST upsert (ON CONFLICT DO UPDATE) fails under this table's write-only
  // RLS policies (42501) — plain insert + update-on-conflict keeps it write-only.
  const now = new Date().toISOString();
  const ins = await supabase.from("user_google_tokens").insert({
    user_id: userId, refresh_token: refresh, updated_at: now,
  });
  if (!ins.error) {
    console.info("[schwanki] google refresh token captured");
    return true;
  }
  if (ins.error.code !== "23505") {
    console.error("[schwanki] user_google_tokens insert failed", ins.error);
    return false;
  }
  const upd = await supabase.from("user_google_tokens")
    .update({ refresh_token: refresh, updated_at: now })
    .eq("user_id", userId);
  if (upd.error) {
    console.error("[schwanki] user_google_tokens update failed", upd.error);
    return false;
  }
  console.info("[schwanki] google refresh token captured");
  return true;
}
