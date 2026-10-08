import { createClient } from "@supabase/supabase-js";
import { parse, createAnthropicProvider, createDeepSeekProvider, createOpenRouterParsingProvider, type SourceMeta } from "@schwanki/parsing";
import { dedupKey } from "@schwanki/core";

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  // Cron-only function: reject anything not bearing the service-role key
  // (verify_jwt accepts any valid JWT, including the public anon key).
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = adminClient();
  const { data: jobs, error } = await supabase.rpc("claim_llm_jobs", { batch_size: 10 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const provider = Deno.env.get("PARSE_PROVIDER") ?? "deepseek";
  const model = Deno.env.get("PARSE_MODEL");
  const keyName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : provider === "openrouter" ? "OPENROUTER_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : null;
  if (!keyName) return Response.json({ error: "Unsupported PARSE_PROVIDER." }, { status: 500 });
  const apiKey = Deno.env.get(keyName);
  const llm = apiKey
    ? provider === "deepseek" ? createDeepSeekProvider(apiKey, model)
      : provider === "openrouter" ? createOpenRouterParsingProvider(apiKey, model)
      : createAnthropicProvider(apiKey, model)
    : undefined;

  const done: string[] = [];
  const failed: string[] = [];

  for (const job of jobs ?? []) {
    try {
      const { source_id, chunk } = job.payload as { source_id: string; chunk: string };
      const { data: source } = await supabase.from("sources").select("*").eq("id", source_id).single();
      if (!source) throw new Error(`source ${source_id} gone`);

      const meta: SourceMeta = { type: source.type, language: source.language, externalRef: source.external_ref };
      const cards = await parse(chunk, meta, llm);

      // Dedup layer 2 & 3: against pending candidates and the deck (§6.3)
      const [{ data: pending }, { data: deck }] = await Promise.all([
        supabase.from("candidate_cards").select("front")
          .eq("source_id", source_id).eq("status", "pending"),
        supabase.from("cards").select("front, language").eq("user_id", source.user_id),
      ]);
      const existing = new Set([
        ...(pending ?? []).map((r) => dedupKey(r.front, source.language)),
        ...(deck ?? []).map((r) => dedupKey(r.front, r.language)),
      ]);
      const fresh = cards.filter((c) => !existing.has(dedupKey(c.front, meta.language)));

      if (fresh.length > 0) {
        const { error: insErr } = await supabase.from("candidate_cards").insert(
          fresh.map((c) => ({
            source_id,
            front: c.front, back: c.back,
            reading: c.reading ?? null, example_sentence: c.exampleSentence ?? null,
            raw_context: c.rawContext, confidence: c.confidence, parse_notes: c.parseNotes ?? null,
          })),
        );
        if (insErr) throw insErr;
      }

      await supabase.from("llm_jobs").update({ status: "done" }).eq("id", job.id);
      done.push(`${job.id}:${fresh.length}`);
    } catch (e) {
      const retryable = (job.attempts ?? 1) < 3;
      await supabase.from("llm_jobs").update({
        status: retryable ? "pending" : "failed",
        run_after: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 min backoff
        last_error: (e as Error).message,
      }).eq("id", job.id);
      failed.push(`${job.id}:${(e as Error).message}`);
    }
  }
  return Response.json({ done, failed });
});
