import { useEffect, useState } from "react";
import type { DueCard, ReviewRating, SchwankiCard } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { CardEditor } from "./CardEditor";
import { MakeItMemorable } from "./MakeItMemorable";
import { MnemonicMedia } from "./MnemonicMedia";
import { saveManualMedia } from "@/lib/manualMedia";

const RATINGS: Array<[ReviewRating, string, string]> = [
  ["again", "1", "Forgot"],
  ["hard", "2", "Hard"],
  ["good", "3", "Got it"],
  ["easy", "4", "Too easy"],
];

export function ReviewCard({ due, onRate, onEdited }: { due: DueCard; onRate: (r: ReviewRating) => void; onEdited: (card: SchwankiCard) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [mediaRefresh, setMediaRefresh] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      // Typing in the hook textarea must not fire rating hotkeys (1-4) or flip.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.closest("button, a, select, summary")) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault(); // stop page scroll on Space
        setFlipped(true);
        return;
      }
      const hit = RATINGS.find(([, k]) => k === e.key);
      if (flipped && hit) {
        e.preventDefault();
        onRate(hit[0]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, onRate, editing]);

  if (editing) return <CardEditor id={due.card.id} kind="card"
    initial={{ front: due.card.front, back: due.card.back, reading: due.card.reading ?? "", exampleSentence: due.card.exampleSentence ?? "" }}
    onSave={async (edits, media) => {
      await api.updateCard(due.card.id, edits);
      await saveManualMedia(due.card.id, media);
      onEdited({ ...due.card, ...edits });
      setEditing(false);
    }} onCancel={() => setEditing(false)} />;

  return (
    <div className="review-workspace space-y-6">
      <button onClick={() => setEditing(true)} className="review-edit text-sm font-bold underline text-ink/60">Edit card / fill missing fields</button>
      {/* div, not button: the flipped face hosts interactive media (play button), which
          can't nest inside a <button>. Space/Enter flipping stays on the window keydown. */}
      <div onClick={() => setFlipped(true)} role={flipped ? undefined : "button"} tabIndex={flipped ? undefined : 0}
        aria-label={flipped ? undefined : `Show meaning of ${due.card.front}`}
        className={`review-face ${flipped ? "" : "cursor-pointer"}`}>
        <p className="app-eyebrow mb-5">{flipped ? "How well did you know it?" : "A moment of recall"}</p>
        <p className="review-word font-black tracking-tight">{due.card.front}</p>
        {due.card.reading && <p className="mt-2 text-xl text-ink/60">{due.card.reading}</p>}
        {flipped && (
          <div className="review-answer mt-6 pt-6">
            <p className="text-2xl font-bold">{due.card.back}</p>
            <MnemonicMedia cardId={due.card.id} word={due.card.front} sourceExample={due.card.exampleSentence} refreshKey={mediaRefresh} />
          </div>
        )}
        {!flipped && <p className="mt-8 text-sm text-ink/70">Tap or press Space to show the meaning</p>}
      </div>
      {flipped && (
        <div className="rating-bar" role="group" aria-label="How well did you know it?">
          {RATINGS.map(([r, key, label]) => (
            <button key={r} onClick={(e) => { e.currentTarget.blur(); onRate(r); }}
              className={`rounded-lg px-2 py-3 text-sm font-bold transition-colors sm:text-base ${r === "again" ? "bg-ink text-paper" : r === "good" ? "bg-ruled text-paper" : "border border-ink/50 hover:bg-white"}`}>
              {label}<span className="block text-xs font-normal">{key}</span>
            </button>
          ))}
        </div>
      )}
      {flipped && <MakeItMemorable cardId={due.card.id} onGenerated={() => setMediaRefresh((n) => n + 1)} />}
    </div>
  );
}
