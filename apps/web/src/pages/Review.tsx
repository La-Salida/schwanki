import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bucketCounts, type DueCard, type ReviewGroup, type Source, type Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { flushOutbox } from "@/offline/outbox";
import { loadDueCards } from "@/lib/dueCards";
import { buildDecks, groupsFromDue, reviewPath } from "@/lib/decks";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { TeacherAvatar } from "@/components/TeacherAvatar";
import { NotificationPrime } from "@/components/NotificationPrime";
import { DueCounts } from "@/components/DueCounts";
import { languageName, teacherKey } from "@/lib/groupSources";

/** The home tab: what's due and a way into it. The swipe review itself is /review (ReviewSession). */
export default function Review() {
  const navigate = useNavigate();
  const [due, setDue] = useState<DueCard[]>([]);
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const load = useCallback(async () => {
    const offline = !navigator.onLine;
    const { cards: loaded, error } = await loadDueCards();
    setLoadError(error);
    setDue(loaded);
    setLoaded(true);
    // Per-deck counts; degrade to due-only counts when offline.
    try {
      if (offline) throw new Error("offline");
      const [g, s] = await Promise.all([api.reviewGroups(), api.listSources()]);
      setGroups(g);
      setSources(s);
    } catch {
      setGroups(groupsFromDue(loaded));
    }
    if (offline) return;
    api.listPendingCandidates().then((c) => setInboxCount(c.length)).catch(() => setInboxCount(0));
    api.listTeachers().then(setTeachers).catch(() => setTeachers([]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const flush = () => void flushOutbox(api);
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  const totalDue = due.length;
  const start = useCallback(() => navigate(reviewPath(null)), [navigate]);
  // Desktop: Enter or Space starts the review unless something else has focus.
  const canStart = loaded && totalDue > 0;
  useEffect(() => {
    if (!canStart) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && document.activeElement === document.body && !e.repeat) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canStart, start]);
  const counts = bucketCounts(due);
  const decks = buildDecks(groups ?? [], sources);
  const dueDecks = decks.filter((d) => d.due > 0);
  return (
    <main id="main-content" className="page-shell space-y-8">
      {loadError && <div role="alert" className="notice"><p>{loadError}</p><button className="font-bold underline" onClick={() => void load()}>Reload cards</button></div>}

      {loaded && totalDue > 0 ? (
        <>
          <h1 className="sr-only">Review</h1>
          {/* The whole card is the button: the one thing this tab is for. */}
          <button onClick={start} className="today-card start-card" aria-label={`Start review: ${totalDue} ${totalDue === 1 ? "card" : "cards"} due`}>
            <span className="block space-y-2">
              <span className="block text-sm font-bold uppercase tracking-wide text-cream/60">Due now</span>
              <span className="today-count block font-black tracking-tight">{totalDue} {totalDue === 1 ? "card" : "cards"}</span>
              <DueCounts counts={counts} />
              <span className="block text-cream/70">Across {dueDecks.length} {dueDecks.length === 1 ? "deck" : "decks"}</span>
            </span>
            <span className="start-bar">
              <span>Start review</span>
              <span aria-hidden="true">→</span>
            </span>
            <span className="start-hint" aria-hidden="true">or press Enter</span>
          </button>
        </>
      ) : (
        <section aria-labelledby="review-heading" className="today-card">
          {!loaded ? (
            <>
              <h1 id="review-heading" className="sr-only">Review</h1>
              <p role="status" className="py-4 text-cream/70">Loading your review queue…</p>
            </>
          ) : loadError ? (
            <>
              <h1 id="review-heading" className="sr-only">Review</h1>
              <p className="py-4 text-cream/70">Your review queue isn't available right now.</p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 id="review-heading" className="text-sm font-bold uppercase tracking-wide text-cream/60">Review</h1>
                <p className="text-3xl font-black tracking-tight">{decks.length === 0 ? "Your next word starts here." : "Nothing due right now."}</p>
                <p className="text-cream/70">{decks.length === 0 ? "Bring your Anki decks and keep your progress. Or add class notes to find new words." : "You’re caught up. Your next review will be here when it’s due."}</p>
              </div>
              <img src="/goose.png" alt="" className="w-24 shrink-0" />
            </>
          )}
        </section>
      )}

      <BulkProgressBanner compact />

      {inboxCount > 0 && (
        <Link to="/inbox" className="inbox-nudge">
          <span><strong>{inboxCount} new {inboxCount === 1 ? "word" : "words"}</strong> from your classes are waiting for you to check.</span>
          <span aria-hidden="true" className="font-black">→</span>
        </Link>
      )}
      {loaded && !loadError && decks.length === 0 && inboxCount === 0 && (
        <Link to="/sources" className="primary-button">Bring your decks</Link>
      )}

      {dueDecks.length > 1 && (
        <section aria-labelledby="by-deck-heading" className="space-y-4">
          <h2 id="by-deck-heading" className="text-2xl font-black tracking-tight">Or one deck at a time</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {dueDecks.map((deck) => {
              const deckCounts = bucketCounts(due.filter((d) => deck.sourceIds.includes(d.card.sourceId ?? null) && d.card.language === deck.language));
              const countsLabel = deckCounts.new + deckCounts.learning + deckCounts.review === deck.due
                ? <span className="deck-counts" role="img" aria-label={`${deckCounts.new} new, ${deckCounts.learning} learning, ${deckCounts.review} review`}>
                    {(["new", "learning", "review"] as const).map((b) => <span key={b} className={deckCounts[b] ? b : "zero"} aria-hidden="true">{deckCounts[b]}</span>)}
                  </span>
                : <span className="deck-due">{deck.due} due</span>;
              return (
              <button key={deck.key} onClick={() => navigate(reviewPath(deck.sourceIds, `${deck.teacher} · ${languageName(deck.language)}`))}
                className={`deck-card deck-card-start ${deck.warned ? "border-beak" : ""}`}>
                <TeacherAvatar name={deck.teacher} language={deck.language}
                  photoUrl={teachers.find((t) => teacherKey(t.name) === teacherKey(deck.teacher))?.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-lg font-bold">{deck.teacher}</span>
                  <span className="block text-sm text-ink/60">{languageName(deck.language)}{deck.warned ? " · sync problem" : ""}</span>
                  {/* Phones: the due count sits under the name so long teacher names keep their width. */}
                  <span className="mt-2 inline-block sm:hidden">{countsLabel}</span>
                </span>
                <span className="hidden shrink-0 sm:inline">{countsLabel}</span>
              </button>
              );
            })}
          </div>
        </section>
      )}
      <NotificationPrime />
    </main>
  );
}
