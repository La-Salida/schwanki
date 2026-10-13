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
  // Saved through a definer RPC: the table's write-only RLS makes a client
  // UPDATE match zero rows silently, so re-sign-ins never replaced the token.
  const { error } = await supabase.rpc("store_google_refresh_token", { token: refresh });
  if (error) {
    console.error("[schwanki] storing google refresh token failed", error);
    return false;
  }
  console.info("[schwanki] google refresh token captured");
  return true;
}
