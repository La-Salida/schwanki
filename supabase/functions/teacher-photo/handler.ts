import { corsJson, corsPreflight } from "../_shared/cors.ts";

export interface TeacherPhotoDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  fetchProfile: (url: string) => Promise<string>;
  save: (input: { userId: string; jwt: string; name: string; preplyUrl: string; photoUrl: string }) => Promise<void>;
}

/** Accept only public Preply tutor profiles, normalized without query or fragment. */
export function preplyProfileUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:" || !/^([a-z0-9-]+\.)?preply\.com$/i.test(url.hostname)) return null;
  if (!/\/tutor\/\d+/.test(url.pathname)) return null;
  return `https://${url.hostname.toLowerCase()}${url.pathname}`;
}

/** The profile's og:image, when it is a Preply avatar. */
export function preplyPhoto(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/(property|name)=["']og:image["']/i.test(tag)) continue;
    const content = /content=["']([^"']+)["']/i.exec(tag)?.[1]?.replace(/&amp;/g, "&");
    if (!content) continue;
    try {
      const url = new URL(content);
      if (url.protocol === "https:" && url.hostname === "avatars.preply.com") return url.toString();
    } catch { /* keep looking */ }
  }
  return null;
}

export function createTeacherPhotoHandler(dependencies: TeacherPhotoDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return corsPreflight();
    if (request.method !== "POST") return corsJson({ error: "method not allowed" }, 405);
    const jwt = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const userId = jwt ? await dependencies.authenticate(jwt) : null;
    if (!userId) return corsJson({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const preplyUrl = preplyProfileUrl(body?.preplyUrl);
    if (!name || name.length > 200) return corsJson({ error: "Choose a teacher first." }, 400);
    if (!preplyUrl) return corsJson({ error: "Paste the teacher's Preply profile link, like preply.com/en/tutor/123456." }, 400);
    let html: string;
    try { html = await dependencies.fetchProfile(preplyUrl); }
    catch { return corsJson({ error: "Couldn't open that Preply profile. Check the link and try again." }, 502); }
    const photoUrl = preplyPhoto(html);
    if (!photoUrl) return corsJson({ error: "That Preply profile has no public photo." }, 422);
    await dependencies.save({ userId, jwt, name, preplyUrl, photoUrl });
    return corsJson({ name, preplyUrl, photoUrl });
  };
}
