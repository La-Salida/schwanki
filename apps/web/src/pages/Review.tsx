import { useCallback, useEffect, useRef, useState } from "react";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache";
import { queueReview, flushOutbox } from "@/offline/outbox";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";

export default function Review() {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [done, setDone] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const inFlight = useRef(false);
  // Monotonic counter bumped on every successful rating so the ReviewCard
  // remounts even when card id + queue length are identical (again-on-last-card).
  const appearance = useRef(0);

  const load = useCallback(async () => {
    try {
      const due = await api.listDueCards(new Date());
      await cacheDueCards(due);
      setQueue(buildSessionQueue(due, new Date()));
    } catch {
      const cached = await loadCachedDueCards();
      setQueue(buildSessionQueue(cached, new Date()));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const flush = () => void flushOutbox(api);
    window.addEventListener("online", flush);
    void flushOutbox(api); // flush on mount too
    return () => window.removeEventListener("online", flush);
  }, []);

  async function rate(rating: ReviewRating) {
    if (inFlight.current) return; // re-entrancy guard: covers buttons + hotkeys
    if (!queue || queue.length === 0) return;
    inFlight.current = true;
    try {
      const current = queue[0]!;
      const elapsedMs = Date.now() - shownAt.current;
      const { state, event } = applyReview(current, rating, new Date());
      try {
        await api.saveReview(state, { ...event, elapsedMs });
        setSaveError(null);
        setOfflineNote(null);
      } catch {
        try {
          await queueReview({ state, event: { ...event, elapsedMs } });
          setSaveError(null);
          setOfflineNote("Saved offline — the goose will sync it later.");
        } catch {
          // Queue stays untouched so the user can retry the same card.
          setSaveError("Couldn't save that rating — try again.");
          return;
        }
      }
      appearance.current += 1;
      setDone((d) => d + 1);
      shownAt.current = Date.now();
      if (rating === "again") {
        // relearn soon: push to back of session — requeue with the UPDATED state
        // (not `current`, which still holds the pre-review state; re-applying a
        // review from stale state would discard the review we just saved).
        setQueue((q) => q ? [...q.slice(1), { card: current.card, state }] : q);
      } else {
        setQueue((q) => q?.slice(1) ?? []);
      }
    } finally {
      inFlight.current = false;
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
      {saveError && <p role="alert" className="mb-4 text-sm font-bold text-beak">{saveError}</p>}
      {!saveError && offlineNote && <p role="status" className="mb-4 text-sm font-bold text-ink/50">{offlineNote}</p>}
      <ReviewCard key={queue[0]!.card.id + ":" + appearance.current} due={queue[0]!} onRate={(r) => void rate(r)} />
    </main>
  );
}
