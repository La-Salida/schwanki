import { useEffect, useState } from "react";
import type { DueCard, ReviewRating } from "@schwanki/core";
import { MnemonicButton } from "./MnemonicPopover";
import { MnemonicMedia } from "./MnemonicMedia";

const RATINGS: Array<[ReviewRating, string, string]> = [
  ["again", "1", "Forgot"],
  ["hard", "2", "Hard"],
  ["good", "3", "Got it"],
  ["easy", "4", "Too easy"],
];

export function ReviewCard({ due, onRate }: { due: DueCard; onRate: (r: ReviewRating) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [mediaRefresh, setMediaRefresh] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
  }, [flipped, onRate]);

  return (
    <div className="space-y-6">
      <button onClick={(e) => { e.currentTarget.blur(); setFlipped(true); }}
        className="block w-full rounded-3xl border-2 border-ink/10 bg-white/70 p-10 text-center shadow-sm">
        <p className="text-5xl font-black tracking-tight">{due.card.front}</p>
        {due.card.reading && <p className="mt-2 text-xl text-ink/60">{due.card.reading}</p>}
        {flipped && (
          <div className="mt-6 border-t-2 border-dashed border-ink/10 pt-6">
            <p className="text-2xl font-bold">{due.card.back}</p>
            {due.card.exampleSentence && <p className="mt-3 text-ink/70">{due.card.exampleSentence}</p>}
          </div>
        )}
        {!flipped && <p className="mt-8 text-sm text-ink/40">tap to flip</p>}
      </button>
      {flipped && (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <MnemonicButton cardId={due.card.id} onGenerated={() => setMediaRefresh((n) => n + 1)} />
        </div>
      )}
      {flipped && <MnemonicMedia cardId={due.card.id} refreshKey={mediaRefresh} />}
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map(([r, key, label]) => (
            <button key={r} onClick={(e) => { e.currentTarget.blur(); onRate(r); }}
              className={`rounded-xl px-2 py-3 font-bold transition hover:scale-105 ${r === "again" ? "bg-ink text-cream" : r === "good" ? "bg-beak text-cream" : "border-2 border-ink/15"}`}>
              {label}<span className="block text-xs font-normal opacity-60">{key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
