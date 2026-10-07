import type { CardEdits, CardHelpField } from "../_vendor/core/types.ts";

type OwnedCard = { language: string; context: string };
type Input = { id: string; kind: "card" | "candidate"; field: CardHelpField; draft: CardEdits; guidance: string };
export interface SuggestionDependencies {
  authenticate: (jwt: string) => Promise<string | null>;
  loadOwned: (input: { id: string; kind: Input["kind"]; userId: string; jwt: string }) => Promise<OwnedCard | null>;
  available: () => boolean;
  suggest: (input: Input & OwnedCard) => Promise<string>;
}
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function response(body: object, status = 200) { return Response.json(body, { status, headers }); }

function validate(body: unknown): Input | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (typeof input.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.id)) return null;
  if (input.kind !== "card" && input.kind !== "candidate") return null;
  if (input.field !== "back" && input.field !== "reading") return null;
  if (!input.draft || typeof input.draft !== "object") return null;
  const raw = input.draft as Record<string, unknown>;
  const draft: CardEdits = { front: "", back: "", reading: "", exampleSentence: "" };
  for (const field of Object.keys(draft) as Array<keyof CardEdits>) {
    if (typeof raw[field] !== "string" || raw[field].length > 4000) return null;
    draft[field] = raw[field].trim();
  }
  if (!draft.front) return null;
  const guidance = input.guidance ?? "";
  if (typeof guidance !== "string" || guidance.length > 1000) return null;
  return { id: input.id, kind: input.kind, field: input.field, draft, guidance: guidance.trim() };
}

export function createSuggestionHandler(dependencies: SuggestionDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return response({ error: "method not allowed" }, 405);
    const jwt = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const userId = jwt ? await dependencies.authenticate(jwt) : null;
    if (!userId) return response({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => null);
    const input = validate(body);
    if (!input) return response({ error: "Choose a card and a valid meaning or pronunciation field." }, 400);
    const owned = await dependencies.loadOwned({ id: input.id, kind: input.kind, userId, jwt });
    if (!owned) return response({ error: "Card not found or unavailable." }, 404);
    if (!dependencies.available()) return response({ error: "AI help isn't configured yet. You can edit manually." }, 503);
    try {
      const value = await dependencies.suggest({ ...input, ...owned, context: owned.context.slice(0, 8000) });
      return response({ field: input.field, value });
    } catch {
      return response({ error: "AI couldn't suggest this field. Add context or edit it manually." }, 502);
    }
  };
}
