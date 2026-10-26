import { supabase } from "./supabase";
import { DRIVE_PICK_PARAM } from "./googlePicker";

const redirectTo = window.location.origin + import.meta.env.BASE_URL;

// Sign-in asks only for identity. drive.readonly is a restricted scope: until Google
// approves it, asking for it at sign-in makes Google show "This app is blocked" to
// everyone, so sign-in itself fails.
export const GOOGLE_SIGN_IN_OPTIONS = {
  provider: "google" as const,
  options: { scopes: "openid email profile", redirectTo },
};

// Asked for only when adding a Google Sheet/Doc. drive.file covers just the files the user
// picks in Google's picker, so it needs none of the restricted-scope review drive.readonly does.
// include_granted_scopes keeps any Drive access an older account already granted.
export const GOOGLE_DRIVE_OAUTH_OPTIONS = {
  provider: "google" as const,
  options: {
    scopes: "openid email profile https://www.googleapis.com/auth/drive.file",
    queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    redirectTo: `${window.location.origin}/sources?${DRIVE_PICK_PARAM}=pick`,
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
