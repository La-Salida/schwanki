import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applyReview, buildSessionQueue, type DueCard, type ReviewRating, type ReviewGroup, type Source, type Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache";
import { queueReview, flushOutbox } from "@/offline/outbox";
import { ReviewCard } from "@/components/ReviewCard";
import { StreakScreen } from "@/components/StreakScreen";
import { BulkGenerateModal } from "@/components/BulkGenerateModal";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { TeacherAvatar } from "@/components/TeacherAvatar";
import { NotificationPrime } from "@/components/NotificationPrime";
import { classPdfTeacher } from "@/lib/classPdf";
import { languageName, teacherKey } from "@/lib/groupSources";

type View = { kind: "overview" } | { kind: "session"; label: string };

/** A deck is one teacher's cards in one language, across every class source. */
interface Deck { key: string; teacher: string; language: string; sourceIds: Array<string | null>; due: number; fresh: number; total: number; warned: boolean }

function buildDecks(groups: ReviewGroup[], sources: Source[]): Deck[] {
  const decks = new Map<string, Deck>();
  for (const g of groups) {
    const source = sources.find((s) => s.id === g.sourceId);
    const teacher = g.sourceId === null ? "Your own cards" : source ? classPdfTeacher(source.label) : "Removed class notes";
    const key = `${teacher.toLowerCase()}|${g.language}`;
    const deck = decks.get(key) ?? { key, teacher, language: g.language, sourceIds: [], due: 0, fresh: 0, total: 0, warned: false };
    deck.sourceIds.push(g.sourceId);
    deck.due += g.due; deck.fresh += g.fresh; deck.total += g.total;
    deck.warned ||= source?.status === "error" || source?.status === "revoked";
    decks.set(key, deck);
  }
  return [...decks.values()].sort((a, b) => b.due - a.due || a.teacher.localeCompare(b.teacher));
}

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
  const [inboxCount, setInboxCount] = useState(0);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
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
    api.listPendingCandidates().then((c) => setInboxCount(c.length)).catch(() => setInboxCount(0));
    api.listTeachers().then(setTeachers).catch(() => setTeachers([]));
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

  function startSession(sourceIds: Array<string | null> | null, label: string) {
    const filtered = sourceIds === null ? due : due.filter((d) => sourceIds.includes(d.card.sourceId ?? null));
    setQueue(buildSessionQueue(filtered, new Date()));
    setDone(0);
    shownAt.current = Date.now();
    setView({ kind: "session", label });
  }


  if (view.kind === "overview") {
    const totalDue = due.length;
    const freshDue = due.filter((d) => d.state === null).length;
    const decks = buildDecks(groups ?? [], sources);
    return (
      <main id="main-content" className="page-shell space-y-10">
        {bulkOpen && <BulkGenerateModal onClose={() => { setBulkOpen(false); void load(); }} />}
        <BulkProgressBanner />
        {loadError && <div role="alert" className="notice"><p>{loadError}</p><button className="font-bold underline" onClick={() => void load()}>Reload cards</button></div>}

        <section aria-labelledby="today-heading" className="today-card">
          {!loaded ? (
            <p role="status" className="py-4 text-cream/70">Loading your review queue…</p>
          ) : totalDue > 0 ? (
            <>
              <div className="space-y-2">
                <p id="today-heading" className="text-sm font-bold uppercase tracking-wide text-cream/60">Today's review</p>
                <p className="text-5xl font-black tracking-tight sm:text-6xl">{totalDue} {totalDue === 1 ? "card" : "cards"}</p>
                <p className="text-cream/70">{freshDue === totalDue ? "All new words" : freshDue > 0 ? `${freshDue} new, ${totalDue - freshDue} to refresh` : "All words you've seen before"} · across {decks.filter((d) => d.due > 0).length} {decks.filter((d) => d.due > 0).length === 1 ? "deck" : "decks"}</p>
              </div>
              <button onClick={() => startSession(null, "Today's review")} className="primary-button text-lg hover:bg-cream hover:text-ink">Start review</button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p id="today-heading" className="text-sm font-bold uppercase tracking-wide text-cream/60">Today's review</p>
                <p className="text-3xl font-black tracking-tight">{decks.length === 0 ? "Your notebook starts here." : "Nothing due today."}</p>
                <p className="text-cream/70">{decks.length === 0 ? "Connect your teacher's notes, then approve words in the Inbox." : "The goose nods, once, approvingly. Check for words from your next class."}</p>
              </div>
              <img src="/goose.png" alt="" className="w-24 shrink-0" />
            </>
          )}
        </section>

        {inboxCount > 0 && (
          <Link to="/inbox" className="inbox-nudge">
            <span><strong>{inboxCount} new {inboxCount === 1 ? "word" : "words"}</strong> from your classes are waiting in the Inbox.</span>
            <span aria-hidden="true" className="font-black">→</span>
          </Link>
        )}
        {loaded && decks.length === 0 && inboxCount === 0 && (
          <Link to="/sources" className="primary-button">Connect class notes</Link>
        )}

        {decks.length > 0 && (
          <section aria-labelledby="decks-heading" className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="decks-heading" className="text-2xl font-black tracking-tight">Your decks</h2>
              <Link to="/sources" className="text-sm font-bold text-ink/60 underline">Manage class notes</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {decks.map((deck) => {
                const clickable = deck.due > 0;
                return (
                  <button key={deck.key} disabled={!clickable}
                    onClick={() => startSession(deck.sourceIds, `${deck.teacher} · ${languageName(deck.language)}`)}
                    className={`deck-card ${deck.warned ? "border-beak" : ""} ${clickable ? "" : "deck-card-idle"}`}>
                    <TeacherAvatar name={deck.teacher} language={deck.language}
                      photoUrl={teachers.find((t) => teacherKey(t.name) === teacherKey(deck.teacher))?.photoUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-lg font-bold">{deck.teacher}</span>
                      <span className="block text-sm text-ink/60">{languageName(deck.language)} · {deck.total} {deck.total === 1 ? "card" : "cards"}{deck.warned ? " · sync problem" : ""}</span>
                    </span>
                    <span className={`deck-due ${clickable ? "" : "deck-due-idle"}`}>{clickable ? `${deck.due} due` : "Done"}</span>
                  </button>
                );
              })}
            </div>
            <p><button onClick={() => setBulkOpen(true)} className="text-sm font-bold text-ink/60 underline">Generate memory aids for a deck</button></p>
          </section>
        )}
        <NotificationPrime />
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
            className="text-sm font-bold text-ink/70 underline">Back to today</button>
        </p>
      </main>
    );
  }

  return (
    <main id="main-content" className="page-shell max-w-2xl">
      <p className="mb-2 text-sm font-bold text-ink/40">
        <button onClick={() => { setView({ kind: "overview" }); setQueue(null); void load(); }}
          className="underline">Back to today</button>
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
