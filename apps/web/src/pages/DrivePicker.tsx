import { useEffect, useState } from "react";
import { pickGoogleFile } from "@/lib/googlePicker";

/** Only the iOS app's own scheme may receive the pick. */
export const DRIVE_PICKER_RETURN = "schwanki://drive/picked";

/**
 * Google's file chooser for the iOS app, alone on the page. The app opens this in an
 * auth sheet with a fresh drive.file access token in the URL fragment (never sent to a
 * server), and the sheet closes as soon as we redirect to schwanki://drive/picked.
 */
export function drivePickerParams(hash: string): { token: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return { token: params.get("token") };
}

export function drivePickerResult(file: { url: string; name: string; type: string } | null): string {
  const url = new URL(DRIVE_PICKER_RETURN);
  if (file) {
    url.searchParams.set("url", file.url);
    url.searchParams.set("name", file.name);
    url.searchParams.set("type", file.type);
  } else url.searchParams.set("cancelled", "1");
  return url.toString();
}

export default function DrivePicker() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const { token } = drivePickerParams(window.location.hash);
    // Drop the token from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) { setError("Google didn't hand over access. Close this and try again from the app."); return; }
    pickGoogleFile(token)
      .then((file) => { window.location.href = drivePickerResult(file); })
      .catch((e: Error) => setError(e.message));
  }, []);
  return (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      {error ? (
        <div className="space-y-4">
          <p role="alert">{error}</p>
          <a className="underline font-bold" href={drivePickerResult(null)}>Back to Schwanki</a>
        </div>
      ) : <p className="text-ink/60">Opening Google Drive…</p>}
    </main>
  );
}
