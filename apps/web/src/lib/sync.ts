import type { Source } from "@schwanki/core";
import { supabase } from "@/lib/supabase";

/** Run the sync edge function for one source and return its result token (e.g. "diffed:3"). */
export async function syncSource(source: Source): Promise<string> {
  const fn = source.type === "pdf_upload" ? "sync-pdf" : "sync-google";
  // functions.invoke attaches the session token itself — no manual header
  const { data, error } = await supabase.functions.invoke(fn, { body: { sourceId: source.id } });
  if (error) throw new Error(error.message);
  const result = (data as { results?: Record<string, string> } | null)?.results?.[source.id];
  if (!result) throw new Error("The sync returned no result for this source. Try again.");
  if (result.startsWith("failed:")) throw new Error(result.slice(7));
  return result;
}
