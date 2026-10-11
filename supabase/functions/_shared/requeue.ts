import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Put a source's failed parse jobs back in the queue. A sync whose content is
 * unchanged creates no new job, so without this a parse that failed once (for
 * example while no language model was configured) would never be retried.
 */
export async function requeueFailedParses(supabase: SupabaseClient, sourceId: string): Promise<number> {
  const { data, error } = await supabase.from("llm_jobs")
    .update({ status: "pending", attempts: 0, run_after: new Date().toISOString(), last_error: null })
    .eq("type", "parse").eq("status", "failed").eq("payload->>source_id", sourceId)
    .select("id");
  if (error) {
    console.warn(`requeue failed parses for ${sourceId}: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/**
 * Start parse-worker now instead of waiting for its 10-minute cron, without
 * holding the sync response open while the language model runs.
 */
export function startParsingNow(): void {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const run = fetch(`${url}/functions/v1/parse-worker`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: "{}",
  }).then((response) => response.body?.cancel()).catch((error) => console.warn(`parse-worker kick failed: ${error}`));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(run);
}
