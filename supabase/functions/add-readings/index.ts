import { createClient } from "@supabase/supabase-js";
import { createAnthropicProvider, createDeepSeekProvider, createOpenRouterParsingProvider, suggestReadings } from "@schwanki/parsing";
import { needsReading } from "@schwanki/core";
import { createReadingsHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Same provider choice as the note parser: pronunciations are a parsing-sized task.
function llm() {
  const provider = Deno.env.get("PARSE_PROVIDER") ?? "deepseek";
  const model = Deno.env.get("PARSE_MODEL");
  const keyName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : provider === "openrouter" ? "OPENROUTER_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : null;
  const apiKey = keyName ? Deno.env.get(keyName) : undefined;
  if (!apiKey) return null;
  return provider === "deepseek" ? createDeepSeekProvider(apiKey, model)
    : provider === "openrouter" ? createOpenRouterParsingProvider(apiKey, model)
    : createAnthropicProvider(apiKey, model);
}

Deno.serve(createReadingsHandler({
  authenticate: async (jwt) => {
    if (jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return null;
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    return error ? null : user?.id ?? null;
  },
  loadMissing: async ({ ids, userId }) => {
    const { data, error } = await admin.from("cards").select("id, language, front, back, reading")
      .in("id", ids).eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).filter((c) => !c.reading?.trim())
      .map((c) => ({ id: c.id, language: c.language, front: c.front, back: c.back }));
  },
  needsReading,
  available: () => llm() !== null,
  suggest: (language, cards) => suggestReadings(language, cards, llm()!),
  save: async ({ userId, readings }) => {
    for (const { id, reading } of readings) {
      // Only fill a still-empty reading: a learner's own edit in the meantime wins.
      const { error } = await admin.from("cards").update({ reading }).eq("id", id).eq("user_id", userId).or("reading.is.null,reading.eq.");
      if (error) throw error;
    }
  },
}));
