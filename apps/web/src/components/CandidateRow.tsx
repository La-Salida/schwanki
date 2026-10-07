import { useState } from "react";
import type { CandidateCardRow } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { CardEditor } from "./CardEditor";

export function CandidateRow(props: {
  candidate: CandidateCardRow;
  onApprove: (edited?: { front: string; back: string; reading?: string }) => void;
  onDiscard: () => void;
  onSaved: (candidate: CandidateCardRow) => void;
}) {
  const { candidate: c } = props;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CardEditor id={c.id} kind="candidate"
        initial={{ front: c.front, back: c.back, reading: c.reading ?? "", exampleSentence: c.exampleSentence ?? "" }}
        onSave={async edits => {
          if (c.recordingId) await api.updateCandidate(c.id, edits, c.recordingId);
          else await api.updateCandidate(c.id, edits);
          props.onSaved({ ...c, ...edits });
          setEditing(false);
        }} onCancel={() => setEditing(false)} />
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
        <span className="block text-xs underline text-ink/60">Edit or fill missing fields</span>
        {c.confidence < 0.7 && <span className="text-xs text-beak">⚠ goose isn't sure about this one{c.parseNotes ? `: ${c.parseNotes}` : ""}</span>}
      </button>
    </div>
  );
}
