import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating, type ReviewGroup, type Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache";
import { queueReview, flushOutbox } from "@/offline/outbox";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";
import { BulkGenerateModal } from "@/components/BulkGenerateModal";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { SOURCE_LABEL, timeAgo } from "@/lib/meta";

type View = { kind: "overview" } | { kind: "session"; sourceId: string | null; label: string };

export default function Review() {
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [done, setDone] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "overview" });
  const [due, setDue] = useState<DueCard[]>([]);
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const shownAt = useRef(Date.now());
  const inFlight = useRef(false);
  // Monotonic counter bumped on every successful rating so the ReviewCard
  // remounts even when card id + queue length are identical (again-on-last-card).
  const appearance = useRef(0);

  const load = useCallback(async () => {
    let loaded: DueCard[];
    try {
      loaded = await api.listDueCards(new Date());
      await cacheDueCards(loaded);
      setLoadError(null);
    } catch {
      loaded = await loadCachedDueCards().catch(() => []);
      setLoadError(loaded.length > 0 ? "You're reviewing saved cards. Reconnect to refresh your classes." : "Couldn't load your cards. Check your connection and reload.");
    }
    setDue(loaded);
    setLoaded(true);
    // Dashboard metadata — degrade to due-only counts when offline.
    try {
      const [g, s] = await Promise.all([api.reviewGroups(), api.listSources()]);
      setGroups(g);
      setSources(s);
    } catch {
      const fallback = new Map<string, ReviewGroup>();
      for (const d of loaded) {
        const key = d.card.sourceId ?? "";
        const g = fallback.get(key) ?? { sourceId: d.card.sourceId, language: d.card.language, total: 0, due: 0, fresh: 0 };
        g.total++;
        g.due++;
        if (d.state === null) g.fresh++;
        fallback.set(key, g);
      }
      setGroups([...fallback.values()]);
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
          setOfflineNote("Saved on this device. Your rating will sync when you're online.");
        } catch {
          // Queue stays untouched so the user can retry the same card.
          setSaveError("Couldn't save that rating. Try again.");
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

  function startSession(sourceId: string | null, label: string) {
    const filtered = sourceId === null ? due : due.filter((d) => d.card.sourceId === sourceId);
    setQueue(buildSessionQueue(filtered, new Date()));
    setDone(0);
    shownAt.current = Date.now();
    setView({ kind: "session", sourceId, label });
  }


  if (view.kind === "overview") {
    const totalDue = due.length;
    const rows = (groups ?? []).slice().sort((a, b) => b.due - a.due);
    return (
      <main id="main-content" className="page-shell space-y-6">
        <header className="page-header"><h1>Your words, waiting.</h1><p>Review what's due across your teachers, or choose a class below.</p></header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            {totalDue > 0 && (
              <button onClick={() => startSession(null, "everything")}
                className="primary-button">
                Review everything ({totalDue} due)
              </button>
            )}
            {rows.length > 0 && <button onClick={() => setBulkOpen(true)} className="secondary-button">Generate for a deck</button>}
          </div>
        </div>
        {bulkOpen && <BulkGenerateModal onClose={() => { setBulkOpen(false); void load(); }} />}
        <BulkProgressBanner />
        {loadError && <div role="alert" className="notice"><p>{loadError}</p><button className="font-bold underline" onClick={() => void load()}>Reload cards</button></div>}
        {!loaded ? (
          <p role="status" className="py-8 text-ink/70">Loading your review queue…</p>
        ) : totalDue === 0 && !loadError ? (
          <div className="space-y-4 py-6 text-center">
            <img src="/goose.png" alt="" className="mx-auto w-32" />
            <h2 className="text-2xl font-black">{rows.length === 0 ? "Your notebook starts here." : "Nothing due today."}</h2>
            <p className="text-ink/70">{rows.length === 0 ? "Connect your teacher's notes, then approve words in the Inbox." : "The goose nods, once, approvingly. Check for words from your next class."}</p>
            <Link to={rows.length === 0 ? "/sources" : "/inbox"} className="primary-button">{rows.length === 0 ? "Connect class notes" : "Check the inbox"}</Link>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((g) => {
            const source = sources.find((s) => s.id === g.sourceId);
            const type = source?.type ?? "manual";
            const label = source?.label ?? (g.sourceId === null ? "Manual cards" : "Source");
            const warned = source?.status === "error" || source?.status === "revoked";
            const clickable = g.due > 0;
            return (
              <button key={`${g.sourceId ?? "manual"}|${g.language}`} disabled={!clickable}
                onClick={() => startSession(g.sourceId, label)}
                className={`rounded-xl border p-5 text-left space-y-2 ${warned ? "border-beak" : "border-ink/30"} ${clickable ? "bg-white/60 transition-colors hover:bg-white hover:border-ink" : "bg-white/30"}`}>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 break-words text-lg font-bold">{label}</p>
                  <span className="text-sm text-ink/70">{g.language.toUpperCase()}</span>
                </div>
                <p className="text-sm">
                  <span className={g.due > 0 ? "font-bold text-beak" : "text-ink/40"}>
                    {g.due} due{g.fresh > 0 ? ` (${g.fresh} new)` : ""}
                  </span>
                  <span className="text-ink/40"> · {g.total} total</span>
                </p>
                <p className="text-xs text-ink/40">
                  via {SOURCE_LABEL[type]}
                  {source?.lastSyncedAt ? ` · synced ${timeAgo(source.lastSyncedAt)}` : ""}
                  {warned ? ` · ${source?.status === "revoked" ? "access revoked" : "sync error"}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  if (queue === null) return <main id="main-content" className="page-shell" role="status">Loading your review queue…</main>;
  if (queue.length === 0) {
    return (
      <main id="main-content" className="page-shell max-w-2xl">
        {done > 0 ? <StreakScreen reviewed={done} /> : (
          <div className="text-center space-y-4">
            <img src="/goose.png" alt="" className="mx-auto w-32" />
            <h1 className="text-3xl font-black">Nothing due in this class.</h1>
            <Link to="/inbox" className="primary-button">Check the inbox</Link>
          </div>
        )}
        <p className="mt-6 text-center">
          <button onClick={() => { setView({ kind: "overview" }); setQueue(null); void load(); }}
            className="text-sm font-bold text-ink/70 underline">Back to all teachers</button>
        </p>
      </main>
    );
  }

  return (
    <main id="main-content" className="page-shell max-w-2xl">
      <p className="mb-2 text-sm font-bold text-ink/40">
        <button onClick={() => { setView({ kind: "overview" }); setQueue(null); void load(); }}
          className="underline">Back to all teachers</button>
        <span className="mx-1">·</span>{view.label}
      </p>
      <p className="mb-4 text-sm font-bold text-ink/50">{queue.length} to go · {done} done</p>
      {saveError && <p role="alert" className="mb-4 text-sm font-bold text-beak">{saveError}</p>}
      {!saveError && offlineNote && <p role="status" className="mb-4 text-sm font-bold text-ink/50">{offlineNote}</p>}
      <ReviewCard key={queue[0]!.card.id + ":" + appearance.current} due={queue[0]!} onRate={(r) => void rate(r)}
        onEdited={card => {
          setQueue(current => current?.map(item => item.card.id === card.id ? { ...item, card } : item) ?? null);
          const updatedDue = due.map(item => item.card.id === card.id ? { ...item, card } : item);
          setDue(updatedDue);
          void cacheDueCards(updatedDue);
        }} />
    </main>
  );
}
