import { corsJson, corsPreflight } from "../_shared/cors.ts";

export interface TeacherPhotoDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  fetchProfile: (url: string) => Promise<string>;
  save: (input: { userId: string; jwt: string; name: string; preplyUrl: string; photoUrl: string; language: string | null }) => Promise<void>;
}

/** Accept only public Preply tutor profiles, normalized without query or fragment. */
export function preplyProfileUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:" || !/^([a-z0-9-]+\.)?preply\.com$/i.test(url.hostname)) return null;
  const id = /\/tutor\/(\d+)/.exec(url.pathname)?.[1];
  if (!id) return null;
  // Any locale (/ko/, /es/…) points at the same tutor; read the English page.
  return `https://preply.com/en/tutor/${id}`;
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

const decode = (text: string) => text.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** The tutor's display name ("Tian W.") from the profile's og:title. */
export function preplyName(html: string): string | null {
  const title = /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  const name = title ? decode(title).split(",")[0]!.trim() : "";
  return name && name.length <= 80 ? name : null;
}

/** The language the tutor teaches, as the code Preply attaches to the profile's subject. */
export function preplyLanguage(html: string): string | null {
  const subject = /"subject":\{"id":\d+,"alias":"[a-z-]+"[^}]*/.exec(html)?.[0] ?? "";
  return /"languageCode":"([a-z]{2,3}(?:-[a-z]{2,4})?)"/i.exec(subject)?.[1]?.toLowerCase() ?? null;
}

export function createTeacherPhotoHandler(dependencies: TeacherPhotoDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return corsPreflight();
    if (request.method !== "POST") return corsJson({ error: "method not allowed" }, 405);
    const jwt = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const userId = jwt ? await dependencies.authenticate(jwt) : null;
    if (!userId) return corsJson({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    // name is optional: a new teacher takes the name shown on their Preply profile.
    const requested = typeof body?.name === "string" ? body.name.trim() : "";
    const preplyUrl = preplyProfileUrl(body?.preplyUrl);
    if (requested.length > 200) return corsJson({ error: "That teacher name is too long." }, 400);
    if (!preplyUrl) return corsJson({ error: "Paste the teacher's Preply profile link, like preply.com/en/tutor/123456." }, 400);
    let html: string;
    try { html = await dependencies.fetchProfile(preplyUrl); }
    catch { return corsJson({ error: "Couldn't open that Preply profile. Check the link and try again." }, 502); }
    const photoUrl = preplyPhoto(html);
    const name = requested || preplyName(html);
    if (!name) return corsJson({ error: "Couldn't read the teacher's name from that profile. Type it in instead." }, 422);
    if (!photoUrl) return corsJson({ error: "That Preply profile has no public photo." }, 422);
    const language = preplyLanguage(html);
    await dependencies.save({ userId, jwt, name, preplyUrl, photoUrl, language });
    return corsJson({ name, preplyUrl, photoUrl, language });
  };
}
