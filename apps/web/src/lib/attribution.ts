import { supabase } from "./supabase";

const FIRST_TOUCH_KEY = "schwanki.firstTouch";
const SAVED_KEY = "schwanki.attributionSaved";

export interface FirstTouch {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_path: string;
  first_seen_at: string;
}

export const HEARD_ABOUT = [
  ["reddit", "Reddit"],
  ["short_video", "TikTok, Reels or Shorts"],
  ["youtube", "YouTube"],
  ["teacher", "My teacher or tutor"],
  ["friend", "A friend"],
  ["search", "Google or another search"],
  ["hacker_news", "Hacker News"],
  ["other", "Somewhere else"],
] as const;

export type HeardAbout = (typeof HEARD_ABOUT)[number][0];

function clip(value: string | null, max: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Builds the first-touch record for a page load. Our own pages and the Google sign-in
 *  bounce don't count as referrers. */
export function readFirstTouch(href: string, referrer: string, now: Date): FirstTouch {
  const url = new URL(href);
  const param = (name: string) => clip(url.searchParams.get(name), 200);
  let externalReferrer: string | null = null;
  if (referrer) {
    try {
      const ref = new URL(referrer);
      const internal = ref.host === url.host || ref.host.endsWith("accounts.google.com") || ref.host.endsWith(".supabase.co");
      if (!internal) externalReferrer = clip(`${ref.origin}${ref.pathname}`, 500);
    } catch { /* not a URL */ }
  }
  return {
    utm_source: param("utm_source") ?? param("ref"),
    utm_medium: param("utm_medium"),
    utm_campaign: param("utm_campaign"),
    utm_content: param("utm_content"),
    referrer: externalReferrer,
    landing_path: clip(url.pathname, 500) ?? "/",
    first_seen_at: now.toISOString(),
  };
}

/** Remembers the first visit in this browser. Later visits never overwrite it. */
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return;
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(readFirstTouch(window.location.href, document.referrer, new Date())));
  } catch { /* storage blocked: attribution is best effort */ }
}

function storedFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    return raw ? JSON.parse(raw) as FirstTouch : null;
  } catch { return null; }
}

/** Saves this browser's first touch to the account once. An account that already has a
 *  row (signed up on another device) keeps its original one. */
export async function saveAttribution(userId: string): Promise<void> {
  try {
    if (localStorage.getItem(SAVED_KEY) === userId) return;
    const touch = storedFirstTouch();
    if (!touch) return;
    const { error } = await supabase.from("signup_attribution")
      .upsert({ user_id: userId, ...touch }, { onConflict: "user_id", ignoreDuplicates: true });
    if (!error) localStorage.setItem(SAVED_KEY, userId);
  } catch { /* best effort */ }
}

export async function saveHeardAbout(userId: string, answer: HeardAbout): Promise<void> {
  // Write the first touch first: upsert only sets the columns it is given, so the answer
  // lands on that row instead of creating one the first touch would then be skipped for.
  await saveAttribution(userId);
  const { error } = await supabase.from("signup_attribution")
    .upsert({ user_id: userId, heard_about: answer, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
