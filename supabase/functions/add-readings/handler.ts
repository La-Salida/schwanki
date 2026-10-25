import { corsJson, corsPreflight } from "../_shared/cors.ts";

/** At most this many cards per request keeps one model call per language small. */
export const MAX_CARDS = 60;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type OwnedCard = { id: string; language: string; front: string; back: string };
export interface ReadingDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  /** The caller's own cards among `ids` that have no reading yet. */
  loadMissing: (input: { ids: string[]; userId: string }) => Promise<OwnedCard[]>;
  needsReading: (language: string) => boolean;
  suggest: (language: string, cards: OwnedCard[]) => Promise<Map<string, string>>;
  save: (input: { userId: string; readings: Array<{ id: string; reading: string }> }) => Promise<void>;
  available: () => boolean;
}

function validate(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as { cardIds?: unknown }).cardIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_CARDS) return null;
  if (!ids.every((id) => typeof id === "string" && UUID.test(id))) return null;
  return [...new Set(ids as string[])];
}

/** Fills missing pronunciations for the caller's cards. Returns the readings it saved,
 *  so the client can show them without reloading. Cards the model was unsure about
 *  come back untouched and are not retried here. */
export function createReadingsHandler(deps: ReadingDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return corsPreflight();
    if (request.method !== "POST") return corsJson({ error: "method not allowed" }, 405);
    const jwt = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const userId = jwt ? await deps.authenticate(jwt) : null;
    if (!userId) return corsJson({ error: "unauthorized" }, 401);
    const ids = validate(await request.json().catch(() => null));
    if (!ids) return corsJson({ error: `Send 1 to ${MAX_CARDS} card ids.` }, 400);
    if (!deps.available()) return corsJson({ error: "Pronunciation help isn't configured yet." }, 503);

    const cards = (await deps.loadMissing({ ids, userId })).filter((c) => deps.needsReading(c.language));
    const byLanguage = new Map<string, OwnedCard[]>();
    for (const card of cards) byLanguage.set(card.language, [...(byLanguage.get(card.language) ?? []), card]);

    const readings: Record<string, string> = {};
    let failures = 0;
    for (const [language, group] of byLanguage) {
      try {
        const got = await deps.suggest(language, group);
        for (const card of group) {
          const reading = got.get(card.front);
          if (reading) readings[card.id] = reading;
        }
      } catch {
        failures += 1;
      }
    }
    const saved = Object.entries(readings).map(([id, reading]) => ({ id, reading }));
    if (saved.length > 0) {
      try { await deps.save({ userId, readings: saved }); }
      catch { return corsJson({ error: "Couldn't save the pronunciations." }, 500); }
    }
    if (saved.length === 0 && failures > 0) return corsJson({ error: "AI couldn't work out the pronunciations right now." }, 502);
    return corsJson({ readings, considered: cards.length });
  };
}
