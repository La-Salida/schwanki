import type { Session } from "@supabase/supabase-js";

// Public values from the Google Cloud project behind Schwanki's OAuth client. The API key
// is a browser key restricted to schwankiapp.com; the app id is the project number, which
// ties picked files to the same app the server's drive.file refresh token belongs to.
const PICKER_API_KEY = "AIzaSyAsfQPYtVwtGvQNavSRlbCmAAQnrSS-c-s";
const PICKER_APP_ID = "433611221903";
export const GOOGLE_PICKER_CONFIG = {
  apiKey: (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) || PICKER_API_KEY,
  appId: (import.meta.env.VITE_GOOGLE_APP_ID as string | undefined) || PICKER_APP_ID,
};

export const pickerConfigured = () => Boolean(GOOGLE_PICKER_CONFIG.apiKey && GOOGLE_PICKER_CONFIG.appId);

/** The query flag connectGoogleDrive returns with, so the page opens the picker on arrival. */
export const DRIVE_PICK_PARAM = "drive";
/** Set alongside it when the pick is for reconnecting an existing source rather than adding one. */
export const DRIVE_SOURCE_PARAM = "source";

/** Where Google sends the user back after granting Drive access. */
export function drivePickReturnUrl(sourceId?: string): string {
  const url = new URL("/sources", window.location.origin);
  url.searchParams.set(DRIVE_PICK_PARAM, "pick");
  if (sourceId) url.searchParams.set(DRIVE_SOURCE_PARAM, sourceId);
  return url.toString();
}

/** The source id a Drive consent round-trip was started for, if any. */
export function drivePickSourceId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.has(DRIVE_PICK_PARAM) ? params.get(DRIVE_SOURCE_PARAM) : null;
}

export const googleFileId = (ref: string): string | undefined => /\/d\/([^/?#]+)/.exec(ref)?.[1];

const TOKEN_KEY = "schwanki:drive-token";
// Google access tokens last an hour; stop using ours a little before that.
const TOKEN_TTL_MS = 50 * 60 * 1000;

export type PickedGoogleFile = { url: string; name: string; type: "google_sheet" | "google_doc" };

/** Right after the Drive consent redirect, keep its short-lived access token for the picker. */
export function rememberDriveToken(session: Session | null): void {
  if (!session?.provider_token) return;
  if (!new URLSearchParams(window.location.search).has(DRIVE_PICK_PARAM)) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: session.provider_token, exp: Date.now() + TOKEN_TTL_MS }));
  } catch { /* private mode: the user just gets asked to connect again */ }
}

export function driveToken(): string | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null") as { token?: string; exp?: number } | null;
    return saved?.token && (saved.exp ?? 0) > Date.now() ? saved.token : null;
  } catch { return null; }
}

/** Drop the ?drive=pick flag so a reload doesn't reopen the picker. */
export function clearDrivePickFlag(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DRIVE_PICK_PARAM)) return;
  url.searchParams.delete(DRIVE_PICK_PARAM);
  url.searchParams.delete(DRIVE_SOURCE_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

const SHEET = "application/vnd.google-apps.spreadsheet";
const DOC = "application/vnd.google-apps.document";

export const PICKER_NOT_READY = "Google Drive isn't connected to Schwanki yet. Upload a PDF for now.";

let pickerLoad: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  pickerLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => window.gapi!.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Google's file picker didn't load.")) });
    script.onerror = () => reject(new Error("Google's file picker didn't load. Check your connection."));
    document.head.appendChild(script);
  }).catch((error: unknown) => { pickerLoad = null; throw error; });
  return pickerLoad;
}

/** Opens Google's own file picker; resolves with the chosen Doc/Sheet, or null if cancelled. */
export async function pickGoogleFile(token: string): Promise<PickedGoogleFile | null> {
  if (!pickerConfigured()) throw new Error(PICKER_NOT_READY);
  await loadPicker();
  const picker = window.google!.picker;
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(`${DOC},${SHEET}`).setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_PICKER_CONFIG.apiKey)
      .setAppId(GOOGLE_PICKER_CONFIG.appId)
      .setOrigin(window.location.origin)
      .setTitle("Choose a Google Doc or Sheet")
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === picker.Action.CANCEL) resolve(null);
        if (data.action !== picker.Action.PICKED) return;
        const doc = data.docs?.[0];
        if (!doc) { resolve(null); return; }
        const type = doc.mimeType === SHEET ? "google_sheet" : "google_doc";
        const url = type === "google_sheet"
          ? `https://docs.google.com/spreadsheets/d/${doc.id}/edit`
          : `https://docs.google.com/document/d/${doc.id}/edit`;
        resolve({ url, name: doc.name, type });
      })
      .build()
      .setVisible(true);
  });
}

type GooglePickerResponse = { action: string; docs?: { id: string; name: string; mimeType: string }[] };

declare global {
  interface Window {
    // Only the slice of gapi / google.picker this file uses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gapi?: { load: (lib: string, options: { callback: () => void; onerror: () => void }) => void };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: { picker: any };
  }
}
