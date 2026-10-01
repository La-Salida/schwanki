import { useCallback, useEffect, useRef, useState } from "react";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating, type ReviewGroup, type Source } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache";
import { queueReview, flushOutbox } from "@/offline/outbox";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";
import { SOURCE_ICON, SOURCE_LABEL, flagFor, timeAgo } from "@/lib/meta";

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
    } catch {
      loaded = await loadCachedDueCards();
    }
    setDue(loaded);
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

  function startSession(sourceId: string | null, label: string) {
    const filtered = sourceId === null ? due : due.filter((d) => d.card.sourceId === sourceId);
    setQueue(buildSessionQueue(filtered, new Date()));
    setDone(0);
    shownAt.current = Date.now();
    setView({ kind: "session", sourceId, label });
  }

  if (due === null && queue === null) return <main className="p-6 text-center pt-24">Shuffling the notebook…</main>;

  if (view.kind === "overview") {
    const totalDue = due.length;
    if (totalDue === 0 && (groups === null || groups.every((g) => g.due === 0))) {
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
    const rows = (groups ?? []).slice().sort((a, b) => b.due - a.due);
    return (
      <main className="mx-auto max-w-2xl p-6 pt-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-black">What's due</h1>
          <button onClick={() => startSession(null, "everything")}
            className="rounded-xl bg-beak px-5 py-2.5 font-bold text-cream">
            Review everything ({totalDue} due)
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((g) => {
            const source = sources.find((s) => s.id === g.sourceId);
            const type = source?.type ?? "manual";
            const label = source?.label ?? (g.sourceId === null ? "Manual cards" : "Source");
            const warned = source?.status === "error" || source?.status === "revoked";
            const clickable = g.due > 0;
            return (
              <button key={`${g.sourceId ?? "manual"}|${g.language}`} disabled={!clickable}
                onClick={() => startSession(g.sourceId, label)}
                className={`rounded-2xl border-2 p-4 text-left space-y-1.5 ${warned ? "border-beak/60" : "border-ink/10"} ${clickable ? "bg-white/60 transition hover:scale-[1.02] hover:border-ink/30" : "bg-white/30 opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{SOURCE_ICON[type]}</span>
                  <p className="min-w-0 flex-1 truncate font-bold">{label}</p>
                  <span className="text-xl" title={g.language}>{flagFor(g.language)}</span>
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
        <p className="mt-6 text-center">
          <button onClick={() => { setView({ kind: "overview" }); setQueue(null); void load(); }}
            className="text-sm font-bold text-ink/50 underline">← all teachers</button>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6 pt-10">
      <p className="mb-2 text-sm font-bold text-ink/40">
        <button onClick={() => { setView({ kind: "overview" }); setQueue(null); void load(); }}
          className="underline">← all teachers</button>
        <span className="mx-1">·</span>{view.label}
      </p>
      <p className="mb-4 text-sm font-bold text-ink/50">{queue.length} to go · {done} done</p>
      {saveError && <p role="alert" className="mb-4 text-sm font-bold text-beak">{saveError}</p>}
      {!saveError && offlineNote && <p role="status" className="mb-4 text-sm font-bold text-ink/50">{offlineNote}</p>}
      <ReviewCard key={queue[0]!.card.id + ":" + appearance.current} due={queue[0]!} onRate={(r) => void rate(r)} />
    </main>
  );
}
