import { createClient } from "@supabase/supabase-js";
import { createAnthropicProvider, suggestCardField } from "@schwanki/parsing";
import { createSuggestionHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(createSuggestionHandler({
  authenticate: async jwt => {
    if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return null;
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    return error ? null : user?.id ?? null;
  },
  loadOwned: async ({ id, kind, userId, jwt }) => {
    // Use the user's JWT for content reads so RLS remains in force.
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    if (kind === "candidate") {
      const { data, error } = await db.from("candidate_cards")
        .select("raw_context, sources!inner(language, user_id)").eq("id", id).eq("sources.user_id", userId).maybeSingle();
      if (error || !data) return null;
      const source = Array.isArray(data.sources) ? data.sources[0] : data.sources;
      if (!source?.language || source.user_id !== userId) return null;
      return { language: source.language, context: data.raw_context ?? "" };
    }
    const { data, error } = await db.from("cards").select("language, source_id, front, example_sentence")
      .eq("id", id).eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    let context = data.example_sentence ?? "";
    if (data.source_id) {
      const { data: candidate } = await db.from("candidate_cards").select("raw_context")
        .eq("source_id", data.source_id).eq("front", data.front).limit(1).maybeSingle();
      if (candidate?.raw_context) context = candidate.raw_context;
    }
    return { language: data.language, context };
  },
  available: () => Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
  suggest: input => suggestCardField(input, createAnthropicProvider(
    Deno.env.get("ANTHROPIC_API_KEY")!, Deno.env.get("PARSE_MODEL") ?? "claude-haiku-4-5",
  )),
}));
