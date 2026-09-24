import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function StreakScreen({ reviewed }: { reviewed: number }) {
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("review_events").select("reviewed_at")
        .eq("user_id", user!.id).order("reviewed_at", { ascending: false }).limit(500);
      const days = new Set((data ?? []).map((r) => (r.reviewed_at as string).slice(0, 10)));
      let n = 0;
      const cursor = new Date();
      if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toISOString().slice(0, 10))) { n++; cursor.setDate(cursor.getDate() - 1); }
      setStreak(n);
    })();
  }, []);
  return (
    <div className="text-center space-y-4">
      <img src="/goose.png" alt="" className="mx-auto w-32" />
      <p className="text-5xl font-black text-beak">{streak ?? "…"}-day streak</p>
      <p className="text-lg">{reviewed} cards. {streak && streak >= 7 ? "The goose is genuinely impressed. Don't ruin it." : "Cute. The notebook is still mostly unread."}</p>
    </div>
  );
}
