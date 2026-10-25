import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DueCard, ReviewGroup, Source, Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { removeCachedDeck } from "@/offline/dueCache";
import { flushOutbox } from "@/offline/outbox";
import { encodeDeckSources, loadDueCards } from "@/lib/dueCards";
import { useDialog } from "@/lib/useDialog";
import { BulkGenerateModal } from "@/components/BulkGenerateModal";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { TeacherAvatar } from "@/components/TeacherAvatar";
import { NotificationPrime } from "@/components/NotificationPrime";
import { classPdfTeacher } from "@/lib/classPdf";
import { languageName, teacherKey } from "@/lib/groupSources";

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

/** Today: the dashboard. The focused swipe review lives at /review (ReviewSession). */
export default function Review() {
  const navigate = useNavigate();
  const [due, setDue] = useState<DueCard[]>([]);
  const [groups, setGroups] = useState<ReviewGroup[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // null: closed. An empty object opens the deck picker; with a deck, that deck is preselected.
  const [bulk, setBulk] = useState<{ deck?: { teacher: string; language: string } } | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [deleting, setDeleting] = useState<Deck | null>(null);
  const load = useCallback(async () => {
    const offline = !navigator.onLine;
    const { cards: loaded, error } = await loadDueCards();
    setLoadError(error);
    setDue(loaded);
    setLoaded(true);
    // Dashboard metadata — degrade to due-only counts when offline.
    try {
      if (offline) throw new Error("offline");
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

  function startSession(sourceIds: Array<string | null> | null, label: string) {
    navigate(sourceIds === null ? "/review" : `/review?${new URLSearchParams({ sources: encodeDeckSources(sourceIds), label })}`);
  }

  const totalDue = due.length;
  const freshDue = due.filter((d) => d.state === null).length;
  const decks = buildDecks(groups ?? [], sources);
  return (
    <main id="main-content" className="page-shell space-y-10">
      {bulk && <BulkGenerateModal initialDeck={bulk.deck} onClose={() => { setBulk(null); void load(); }} />}
      {deleting && <DeleteDeckDialog deck={deleting} onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); void load(); }} />}
      <BulkProgressBanner />
      <header className="page-header"><p className="app-eyebrow">A little every day</p><h1>Your words. Coming back.</h1><p>A finite queue. A little recall. Then get on with your day.</p></header>
      {loadError && <div role="alert" className="notice"><p>{loadError}</p><button className="font-bold underline" onClick={() => void load()}>Reload cards</button></div>}

      <section aria-labelledby="today-heading" className="today-card">
        {!loaded ? (
          <p role="status" className="py-4 text-cream/70">Loading your review queue…</p>
        ) : loadError && totalDue === 0 ? (
          <p className="py-4 text-cream/70">Your review queue isn't available right now.</p>
        ) : totalDue > 0 ? (
          <>
            <div className="space-y-2">
              <p id="today-heading" className="text-sm font-bold uppercase tracking-wide text-cream/60">Today's review</p>
              <p className="today-count font-black tracking-tight">{totalDue} {totalDue === 1 ? "card" : "cards"}</p>
              <p className="text-cream/70">{freshDue === totalDue ? "All new words" : freshDue > 0 ? `${freshDue} new, ${totalDue - freshDue} to refresh` : "All words you've seen before"} · across {decks.filter((d) => d.due > 0).length} {decks.filter((d) => d.due > 0).length === 1 ? "deck" : "decks"}</p>
            </div>
            <button onClick={() => startSession(null, "Today's review")} className="primary-button text-lg hover:bg-cream hover:text-ink">Start review</button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p id="today-heading" className="text-sm font-bold uppercase tracking-wide text-cream/60">Today's review</p>
              <p className="text-3xl font-black tracking-tight">{decks.length === 0 ? "Your next word starts here." : "Nothing due today."}</p>
              <p className="text-cream/70">{decks.length === 0 ? "Bring your Anki decks and keep your progress. Or add class notes to find new words." : "You’re caught up. Your next review will be here when it’s due."}</p>
            </div>
            <img src="/goose.png" alt="" className="w-24 shrink-0" />
          </>
        )}
      </section>

      {decks.length > 0 && (
        <section aria-labelledby="aids-heading" className="aids-card">
          <img src="/goose.png" alt="" className="aids-goose" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="app-eyebrow">Memory aids</p>
            <h2 id="aids-heading" className="text-2xl font-black tracking-tight">Make the words stick.</h2>
            <p className="text-ink/70">A memorable sentence, a scene picture and native audio for every card in a deck. I make them in the background.</p>
          </div>
          <button onClick={() => setBulk({})} className="primary-button">Generate memory aids</button>
        </section>
      )}

      {inboxCount > 0 && (
        <Link to="/inbox" className="inbox-nudge">
          <span><strong>{inboxCount} new {inboxCount === 1 ? "word" : "words"}</strong> from your classes are waiting in the Inbox.</span>
          <span aria-hidden="true" className="font-black">→</span>
        </Link>
      )}
      {loaded && !loadError && decks.length === 0 && inboxCount === 0 && (
        <Link to="/sources" className="primary-button">Bring your decks</Link>
      )}

      {decks.length > 0 && (
        <section aria-labelledby="decks-heading" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="decks-heading" className="text-2xl font-black tracking-tight">Your decks</h2>
            <Link to="/sources" className="inline-flex min-h-11 items-center text-sm font-bold text-ink/60 underline">Manage decks &amp; notes</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => {
              const clickable = deck.due > 0;
              return (
                <div key={deck.key} className="relative">
                <button disabled={!clickable}
                  onClick={() => startSession(deck.sourceIds, `${deck.teacher} · ${languageName(deck.language)}`)}
                  className={`deck-card pr-12 ${deck.warned ? "border-beak" : ""} ${clickable ? "" : "deck-card-idle"}`}>
                  <TeacherAvatar name={deck.teacher} language={deck.language}
                    photoUrl={teachers.find((t) => teacherKey(t.name) === teacherKey(deck.teacher))?.photoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-lg font-bold">{deck.teacher}</span>
                    <span className="block text-sm text-ink/60">{languageName(deck.language)} · {deck.total} {deck.total === 1 ? "card" : "cards"}{deck.warned ? " · sync problem" : ""}</span>
                    {/* Phones: the due count sits under the name so long teacher names keep their width. */}
                    <span className={`deck-due mt-2 inline-block sm:hidden ${clickable ? "" : "deck-due-idle px-0"}`}>{clickable ? `${deck.due} due` : "Done"}</span>
                  </span>
                  <span className={`deck-due hidden sm:inline ${clickable ? "" : "deck-due-idle"}`}>{clickable ? `${deck.due} due` : "Done"}</span>
                </button>
                <button onClick={() => setDeleting(deck)} aria-label={`Delete the ${deck.teacher} ${languageName(deck.language)} deck`}
                  title="Delete deck" className="deck-delete">✕</button>
                <button onClick={() => setBulk({ deck: { teacher: deck.teacher, language: deck.language } })}
                  aria-label={`Generate memory aids for the ${deck.teacher} ${languageName(deck.language)} deck`}
                  className="deck-aids">Memory aids</button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <NotificationPrime />
    </main>
  );
}

function DeleteDeckDialog({ deck, onClose, onDeleted }: { deck: Deck; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialog(() => { if (!busy) onClose(); });
  const name = `${deck.teacher} · ${languageName(deck.language)}`;
  async function remove() {
    setBusy(true); setError(null);
    try {
      await api.deleteDeck(deck.sourceIds, deck.language);
      await removeCachedDeck(deck.sourceIds, deck.language);
      onDeleted();
    }
    catch (failure) { setError(`Couldn't delete this deck: ${(failure as Error).message}`); setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-6" role="dialog" aria-modal="true" aria-label={`Delete ${name}`}>
      <div ref={ref} tabIndex={-1} className="dialog-panel space-y-4">
        <h2 className="text-xl font-black">Delete “{name}”?</h2>
        <p className="text-sm">This deletes its {deck.total} {deck.total === 1 ? "card" : "cards"} and their review history. {deck.sourceIds.some((id) => id !== null) ? "Your class notes stay, so you can sync them again later." : ""}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="secondary-button">Cancel</button>
          <button onClick={() => void remove()} disabled={busy} className="primary-button">{busy ? "Deleting…" : "Delete deck"}</button>
        </div>
        {error && <p role="alert" className="error-notice">{error}</p>}
      </div>
    </div>
  );
}
