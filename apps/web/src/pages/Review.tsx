import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bucketCounts, capNewCards, type DueCard, type ReviewGroup, type Source, type Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { flushOutbox } from "@/offline/outbox";
import { loadDueCards } from "@/lib/dueCards";
import { buildDecks, groupsFromDue, reviewPath } from "@/lib/decks";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { TeacherAvatar } from "@/components/TeacherAvatar";
import { NotificationPrime } from "@/components/NotificationPrime";
import { DueCounts } from "@/components/DueCounts";
import { DEFAULT_NEW_LIMIT, newCardAllowance } from "@/lib/newCardLimit";
import { languageName, teacherKey } from "@/lib/groupSources";
import { homeStreak, type HomeStreak } from "@/lib/streak";
import { recentReviewTimes } from "@/lib/reviewDays";
import { WeekDots } from "@/components/WeekDots";

/** The streak under the start card: what today will do to it, and this week's days. */
function StreakRow({ s, tone }: { s: HomeStreak; tone: "paper" | "ink" }) {
  const note = s.reviewedToday ? "Today is in." : s.streak > 0 ? `Review today to make it ${s.streak + 1}.` : "Review today to start a streak.";
  return (
    <div className={`streak-row streak-row-${tone}`}>
      <p>{s.streak > 0 && <b>{s.streak}-day streak. </b>}{note}</p>
      <WeekDots week={s.week} tone={tone} />
    </div>
  );
}

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
  const [streak, setStreak] = useState<HomeStreak | null>(null);
  const [newLimit, setNewLimit] = useState({ limit: DEFAULT_NEW_LIMIT, allowance: DEFAULT_NEW_LIMIT });
  const load = useCallback(async () => {
    const offline = !navigator.onLine;
    const { cards: loaded, error } = await loadDueCards();
    setNewLimit(await newCardAllowance());
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
    void recentReviewTimes().then((times) => { if (times) setStreak(homeStreak(times)); });
    api.listPendingCandidates().then((c) => setInboxCount(c.length)).catch(() => setInboxCount(0));
    api.listTeachers().then(setTeachers).catch(() => setTeachers([]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const flush = () => void flushOutbox(api);
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  // Today's new-card limit decides how many new words count as due, like Anki.
  const available = capNewCards(due, newLimit.allowance);
  const heldBack = due.length - available.length;
  const totalDue = available.length;
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
  const counts = bucketCounts(available);
  const decks = buildDecks(groups ?? [], sources);
  const deckDue = (deck: (typeof decks)[number]) =>
    capNewCards(due.filter((d) => deck.sourceIds.includes(d.card.sourceId ?? null) && d.card.language === deck.language), newLimit.allowance);
  const dueDecks = decks.filter((d) => deckDue(d).length > 0);
  const limitNote = (tone: string) => heldBack > 0 && <p className={`text-sm ${tone}`}>
    {heldBack} more new {heldBack === 1 ? "word waits" : "words wait"} for tomorrow. You're meeting {newLimit.limit} new a day. <Link to="/settings" className="font-bold underline">Change</Link>
  </p>;
  return (
    <main id="main-content" className="page-shell space-y-8">
      {loadError && <div role="alert" className="notice"><p>{loadError}</p><button className="font-bold underline" onClick={() => void load()}>Reload cards</button></div>}

      {loaded && totalDue > 0 ? (
        <>
          <h1 className="sr-only">Review</h1>
          {/* The whole card is the button: the one thing this tab is for. */}
          <button onClick={start} className="today-card start-card" aria-label={`Start review: ${totalDue} ${totalDue === 1 ? "card" : "cards"} due`}>
            <span className="block space-y-2">
              <span className="block text-sm font-bold uppercase tracking-wide text-paper/60">Due now</span>
              <span className="today-count block font-black tracking-tight">{totalDue} {totalDue === 1 ? "card" : "cards"}</span>
              <DueCounts counts={counts} />
              <span className="block text-paper/70">Across {dueDecks.length} {dueDecks.length === 1 ? "deck" : "decks"}</span>
            </span>
            <span className="start-bar">
              <span>Start review</span>
              <span aria-hidden="true">→</span>
            </span>
            <span className="start-hint" aria-hidden="true">or press Enter</span>
          </button>
          {heldBack > 0 && <div className="-mt-4 px-1">{limitNote("text-ink/70")}</div>}
          {streak && <StreakRow s={streak} tone="paper" />}
        </>
      ) : (
        <section aria-labelledby="review-heading" className="today-card">
          {!loaded ? (
            <>
              <h1 id="review-heading" className="sr-only">Review</h1>
              <p role="status" className="py-4 text-paper/70">Loading your review queue…</p>
            </>
          ) : loadError ? (
            <>
              <h1 id="review-heading" className="sr-only">Review</h1>
              <p className="py-4 text-paper/70">Your review queue isn't available right now.</p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 id="review-heading" className="text-sm font-bold uppercase tracking-wide text-paper/60">Review</h1>
                <p className="text-3xl font-black tracking-tight">{decks.length === 0 ? "Your next word starts here." : heldBack > 0 ? "Done for today." : "Nothing due right now."}</p>
                <p className="text-paper/70">{decks.length === 0 ? "Bring your Anki decks and keep your progress. Or add class notes to find new words." : heldBack > 0 ? "You’ve met today’s new words and you’re caught up on reviews." : "You’re caught up. Your next review will be here when it’s due."}</p>
                {limitNote("text-paper/70")}
                {streak && decks.length > 0 && <StreakRow s={streak} tone="ink" />}
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
              const deckCounts = bucketCounts(deckDue(deck));
              const countsLabel = <span className="deck-counts" role="img" aria-label={`${deckCounts.new} new, ${deckCounts.learning} learning, ${deckCounts.review} review`}>
                    {(["new", "learning", "review"] as const).map((b) => <span key={b} className={deckCounts[b] ? b : "zero"} aria-hidden="true">{deckCounts[b]}</span>)}
                  </span>;
              return (
              <button key={deck.key} onClick={() => navigate(reviewPath(deck.sourceIds, `${deck.teacher} · ${languageName(deck.language)}`))}
                className={`deck-card deck-card-start ${deck.warned ? "border-margin" : ""}`}>
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
