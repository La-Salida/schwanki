import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating, type SchwankiCard } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards } from "@/offline/dueCache";
import { queueReview, flushOutbox, hasQueuedReviews } from "@/offline/outbox";
import { ReviewFeed } from "@/components/ReviewFeed";
import { StreakScreen } from "@/components/StreakScreen";
import { decodeDeckSources, loadDueCards } from "@/lib/dueCards";
import { fillMissingReadings, withReadings } from "@/lib/readings";

/** The focused swipe review. `?sources=` limits it to one deck; without it, everything due. */
export default function ReviewSession() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sourcesParam = params.get("sources");
  const label = params.get("label") ?? "Everything due";
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [due, setDue] = useState<DueCard[]>([]);
  const [done, setDone] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const inFlight = useRef(false);
  // Monotonic counter bumped on every successful rating so the ReviewCard
  // remounts even when card id + queue length are identical (again-on-last-card).
  const appearance = useRef(0);

  const load = useCallback(async () => {
    const { cards, error } = await loadDueCards();
    const sourceIds = decodeDeckSources(sourcesParam);
    setDue(cards);
    setLoadError(error);
    const session = buildSessionQueue(sourceIds === null ? cards : cards.filter((d) => sourceIds.includes(d.card.sourceId ?? null)), new Date());
    setQueue(session);
    setDone(0);
    shownAt.current = Date.now();
    // Pinyin, kana and the like for cards that came in without them. The feed shows
    // them as they arrive; a failure just leaves those cards as they were.
    void fillMissingReadings(session).then((readings) => {
      if (Object.keys(readings).length === 0) return;
      setQueue((q) => q && withReadings(q, readings));
      setDue((d) => { const next = withReadings(d, readings); void cacheDueCards(next); return next; });
    });
  }, [sourcesParam]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const flush = () => void flushOutbox(api);
    window.addEventListener("online", flush);
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
        await queueReview({ state, event: { ...event, elapsedMs } }, current.card);
      } catch {
        setSaveError("Couldn't save that rating. Try again.");
        return;
      }
      setSaveError(null);
      const pendingNote = "Saved on this device. Your rating will sync when you're online.";
      setOfflineNote(navigator.onLine ? null : pendingNote);
      // Advance after the durable local save; a slow connection must not stall scrolling.
      void (async () => {
        try {
          if (navigator.onLine) await flushOutbox(api);
          setOfflineNote(await hasQueuedReviews() ? pendingNote : null);
        } catch {
          setOfflineNote(pendingNote);
        }
      })();
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

  if (queue === null) return <main id="main-content" className="page-shell" role="status">Loading your review queue…</main>;
  if (queue.length === 0) {
    return (
      <main id="main-content" className="page-shell max-w-2xl">
        {done > 0 ? <StreakScreen reviewed={done} /> : (
          <div className="text-center space-y-4">
            <img src="/goose.png" alt="" className="mx-auto w-32" />
            <h1 className="text-3xl font-black">{loadError && due.length === 0 ? "Your review queue isn't available right now." : sourcesParam ? "Nothing due in this deck." : "Nothing due right now."}</h1>
            {loadError && due.length === 0
              ? <><p>{loadError}</p><button onClick={() => void load()} className="primary-button">Reload cards</button></>
              : <Link to="/inbox" className="primary-button">Check the inbox</Link>}
          </div>
        )}
        {offlineNote && <p role="status" className="mt-4 text-center text-sm font-bold text-ink/60">{offlineNote}</p>}
        <p className="mt-6 text-center">
          <Link to="/" className="text-sm font-bold text-ink/70 underline">Back to review</Link>
        </p>
      </main>
    );
  }

  const editCard = (card: SchwankiCard) => {
    setQueue(current => current?.map(item => item.card.id === card.id ? { ...item, card } : item) ?? null);
    const updatedDue = due.map(item => item.card.id === card.id ? { ...item, card } : item);
    setDue(updatedDue);
    void cacheDueCards(updatedDue);
  };

  return (
    <main id="main-content">
      <ReviewFeed queue={queue} done={done} label={label} cardKey={queue[0]!.card.id + ":" + appearance.current}
        saveError={saveError} offlineNote={offlineNote} onRate={(r) => void rate(r)} onEdited={editCard} onExit={() => navigate("/")} />
    </main>
  );
}
