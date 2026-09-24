import { useState } from "react";
import type { CandidateCardRow } from "@schwanki/core";

export function CandidateRow(props: {
  candidate: CandidateCardRow;
  onApprove: (edited?: { front: string; back: string; reading?: string }) => void;
  onDiscard: () => void;
}) {
  const { candidate: c } = props;
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(c.front);
  const [back, setBack] = useState(c.back);
  const [reading, setReading] = useState(c.reading ?? "");

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl bg-cream p-3">
        <input value={front} onChange={(e) => setFront(e.target.value)} className="w-full rounded border px-2 py-1 text-lg font-bold" />
        <input value={reading} onChange={(e) => setReading(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" placeholder="reading" />
        <input value={back} onChange={(e) => setBack(e.target.value)} className="w-full rounded border px-2 py-1" />
        <div className="flex gap-2">
          <button onClick={() => props.onApprove({ front, back, ...(reading ? { reading } : {}) })}
            className="rounded bg-beak px-3 py-1 font-bold text-cream">Save & approve</button>
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-cream p-3">
      <button onClick={() => props.onApprove()} aria-label="approve"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-beak font-black text-cream">✓</button>
      <button onClick={props.onDiscard} aria-label="discard"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink/20 font-black">✕</button>
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-lg font-bold">{c.front}
          {c.reading && <span className="ml-2 text-sm font-normal text-ink/60">{c.reading}</span>}
        </span>
        <span className="block truncate text-sm text-ink/70">{c.back}</span>
        {c.confidence < 0.7 && <span className="text-xs text-beak">⚠ goose isn't sure about this one{c.parseNotes ? `: ${c.parseNotes}` : ""}</span>}
      </button>
    </div>
  );
}
