// Pure helpers for Canva Connect (https://www.canva.dev/docs/connect/), kept apart from the handler for tests.
export const CANVA_AUTHORIZE = "https://www.canva.com/api/oauth/authorize";
export const CANVA_API = "https://api.canva.com/rest/v1";
export const CANVA_SCOPES = "design:meta:read design:content:read";
export const APP_RETURN = "schwanki://canva/connected";
/** PKCE states older than this are refused (and swept). */
export const STATE_TTL_MS = 10 * 60 * 1000;

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function randomToken(size = 48): string {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string, challenge: string): string {
  const url = new URL(CANVA_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", CANVA_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  return url.toString();
}

/** Where the callback sends the person back into the app. */
export function appReturn(error?: string): string {
  const url = new URL(APP_RETURN);
  if (error) url.searchParams.set("error", error);
  return url.toString();
}

export interface DesignSummary { id: string; title: string; thumbnail: string | null; updatedAt: string | null; url: string | null }

// deno-lint-ignore no-explicit-any
export function summarizeDesign(item: any): DesignSummary {
  return {
    id: String(item.id),
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled design",
    thumbnail: item.thumbnail?.url ?? null,
    updatedAt: typeof item.updated_at === "number" ? new Date(item.updated_at * 1000).toISOString() : null,
    url: item.urls?.view_url ?? item.urls?.edit_url ?? null,
  };
}

/** The ref stored on the source: the design's view link when Canva gives one, else a stable id ref. */
export const designRef = (design: { id: string; url: string | null }) => design.url ?? `canva:design:${design.id}`;
