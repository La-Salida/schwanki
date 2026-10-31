import { supabase } from "./supabase";

/** When the learner's recent reviews happened (newest 500), or null when that can't be read. */
export async function recentReviewTimes(): Promise<string[] | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("review_events").select("reviewed_at")
      .eq("user_id", user.id).order("reviewed_at", { ascending: false }).limit(500);
    if (error) return null;
    return (data ?? []).map((r) => r.reviewed_at as string);
  } catch {
    return null;
  }
}
