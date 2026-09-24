import { supabase } from "./supabase";

export const GOOGLE_OAUTH_OPTIONS = {
  provider: "google" as const,
  options: {
    scopes: "openid email profile https://www.googleapis.com/auth/drive.readonly",
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo: window.location.origin,
  },
};

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth(GOOGLE_OAUTH_OPTIONS);
  if (error) throw error;
}

/** Right after OAuth redirect, stash the Google refresh token for server-side sync (§6.1). */
export async function captureGoogleTokens(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const refresh = session?.provider_refresh_token;
  const userId = session?.user.id;
  if (!refresh || !userId) return;
  await supabase.from("user_google_tokens").upsert({
    user_id: userId, refresh_token: refresh, updated_at: new Date().toISOString(),
  });
}
