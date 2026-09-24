import { useCallback, useEffect, useRef, useState } from "react";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";

export default function Review() {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [done, setDone] = useState(0);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    const due = await api.listDueCards(new Date());
    setQueue(buildSessionQueue(due, new Date()));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function rate(rating: ReviewRating) {
    if (!queue || queue.length === 0) return;
    const current = queue[0]!;
    const elapsedMs = Date.now() - shownAt.current;
    const { state, event } = applyReview(current, rating, new Date());
    await api.saveReview(state, { ...event, elapsedMs });
    setDone((d) => d + 1);
    shownAt.current = Date.now();
    if (rating === "again") {
      // relearn soon: push to back of session
      setQueue((q) => q ? [...q.slice(1), current] : q);
    } else {
      setQueue((q) => q?.slice(1) ?? []);
    }
  }

  if (queue === null) return <main className="p-6 text-center pt-24">Shuffling the notebook…</main>;
  if (queue.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-6 pt-16">
        {done > 0 ? <StreakScreen reviewed={done} /> : (
          <div className="text-center space-y-4">
            <img src="/goose.png" alt="" className="mx-auto w-32" />
            <p className="text-xl font-bold">Nothing due. The goose nods, once, approvingly.</p>
            <a href="/inbox" className="inline-block rounded-xl bg-beak px-6 py-3 font-bold text-cream">Check the inbox</a>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 pt-10">
      <p className="mb-4 text-sm font-bold text-ink/50">{queue.length} to go · {done} done</p>
      <ReviewCard key={queue[0]!.card.id + queue.length} due={queue[0]!} onRate={(r) => void rate(r)} />
    </main>
  );
}
