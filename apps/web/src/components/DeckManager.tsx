import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReviewGroup, Source, Teacher } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { removeCachedDeck } from "@/offline/dueCache";
import { useDialog } from "@/lib/useDialog";
import { buildDecks, reviewPath, type Deck } from "@/lib/decks";
import { languageName, teacherKey } from "@/lib/groupSources";
import { BulkGenerateModal } from "@/components/BulkGenerateModal";
import { BulkProgressBanner } from "@/components/BulkProgressBanner";
import { TeacherAvatar } from "@/components/TeacherAvatar";

/** Card decks on the Decks & notes page: memory aids, deleting, and a shortcut into one deck's review. */
export function DeckManager({ sources, teachers }: { sources: Source[]; teachers: Teacher[] }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  // null: closed. An empty object opens the deck picker; with a deck, that deck is preselected.
  const [bulk, setBulk] = useState<{ deck?: { teacher: string; language: string } } | null>(null);
  const [deleting, setDeleting] = useState<Deck | null>(null);
  const load = useCallback(async () => {
    try { setGroups(await api.reviewGroups()); } catch { setGroups([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decks = buildDecks(groups, sources);
  return (
    <>
      {bulk && <BulkGenerateModal initialDeck={bulk.deck} onClose={() => { setBulk(null); void load(); }} />}
      {deleting && <DeleteDeckDialog deck={deleting} onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); void load(); }} />}
      <BulkProgressBanner />

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

      {decks.length > 0 && (
        <section aria-labelledby="decks-heading" className="space-y-4">
          <h2 id="decks-heading" className="text-2xl font-black tracking-tight">Your decks</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => {
              const clickable = deck.due > 0;
              return (
                <div key={deck.key} className="relative">
                <button disabled={!clickable}
                  onClick={() => navigate(reviewPath(deck.sourceIds, `${deck.teacher} · ${languageName(deck.language)}`))}
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
    </>
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
