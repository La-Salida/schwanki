import { supabase } from "./supabase";

const redirectTo = window.location.origin + import.meta.env.BASE_URL;

// Sign-in asks only for identity. drive.readonly is a restricted scope: until Google
// approves it, asking for it at sign-in makes Google show "This app is blocked" to
// everyone, so sign-in itself fails.
export const GOOGLE_SIGN_IN_OPTIONS = {
  provider: "google" as const,
  options: { scopes: "openid email profile", redirectTo },
};

// Asked for only when a Google Sheet/Doc source needs it (Sources → Connect Google Drive).
export const GOOGLE_DRIVE_OAUTH_OPTIONS = {
  provider: "google" as const,
  options: {
    scopes: "openid email profile https://www.googleapis.com/auth/drive.readonly",
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo,
  },
};

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth(GOOGLE_SIGN_IN_OPTIONS);
  if (error) throw error;
}

export async function connectGoogleDrive(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth(GOOGLE_DRIVE_OAUTH_OPTIONS);
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
