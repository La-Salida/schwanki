import { createClient } from "@supabase/supabase-js";
import { parse, createAnthropicProvider, createDeepSeekProvider, createOpenRouterParsingProvider, type SourceMeta } from "@schwanki/parsing";
import { dedupKey } from "@schwanki/core";

const PARSE_ERROR_PREFIX = "Couldn't read words from these notes:";

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  // Cron-only function: reject anything not bearing the service-role key
  // (verify_jwt accepts any valid JWT, including the public anon key).
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // Validate configuration before claiming: a claimed job is only released by the loop below.
  const provider = Deno.env.get("PARSE_PROVIDER") ?? "deepseek";
  const model = Deno.env.get("PARSE_MODEL");
  const keyName = provider === "deepseek" ? "DEEPSEEK_API_KEY" : provider === "openrouter" ? "OPENROUTER_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : null;
  if (!keyName) return Response.json({ error: "Unsupported PARSE_PROVIDER." }, { status: 500 });

  const supabase = adminClient();
  const { data: jobs, error } = await supabase.rpc("claim_llm_jobs", { batch_size: 10 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
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
      // A successful parse clears an earlier "couldn't read words" error on the source.
      if (source.status === "error" && String(source.error_detail ?? "").startsWith(PARSE_ERROR_PREFIX)) {
        await supabase.from("sources").update({ status: "active", error_detail: null }).eq("id", source_id);
      }
      done.push(`${job.id}:${fresh.length}`);
    } catch (e) {
      const message = (e as Error).message;
      const retryable = (job.attempts ?? 1) < 3;
      await supabase.from("llm_jobs").update({
        status: retryable ? "pending" : "failed",
        run_after: new Date(Date.now() + 60_000 * (job.attempts ?? 1)).toISOString(), // 1, 2 min backoff
        last_error: message,
      }).eq("id", job.id);
      // Out of retries: show the reason on the class notes row and in the Inbox import notice.
      const sourceId = (job.payload as { source_id?: string })?.source_id;
      if (!retryable && sourceId && !message.endsWith(" gone")) {
        await supabase.from("sources").update({ status: "error", error_detail: `${PARSE_ERROR_PREFIX} ${message}` }).eq("id", sourceId);
      }
      failed.push(`${job.id}:${(e as Error).message}`);
    }
  }
  return Response.json({ done, failed });
});
