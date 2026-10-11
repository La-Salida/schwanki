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
