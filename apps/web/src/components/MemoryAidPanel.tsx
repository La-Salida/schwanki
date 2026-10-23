import type { SchwankiCard } from "@schwanki/core";
import type { RefObject } from "react";
import { useDialog } from "@/lib/useDialog";
import { MakeItMemorable } from "./MakeItMemorable";

export function MemoryAidPanel({ card, hasMedia, onClose, onGenerated, returnFocus }: {
  card: SchwankiCard; hasMedia: boolean; onClose: () => void; onGenerated: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useDialog(onClose, returnFocus);
  return (
    <div ref={ref} tabIndex={-1} className="feed-sheet memory-editor" role="dialog" aria-modal="true" aria-label="Make it memorable">
      <header className="memory-editor-header">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Make it memorable</h2>
          <button onClick={onClose} className="secondary-button">Back to review</button>
        </div>
        <p lang={card.language} className="memory-editor-word">{card.front}</p>
        {card.reading && <p className="memory-editor-reading">{card.reading}</p>}
        <p className="memory-editor-meaning">{card.back}</p>
      </header>
      <div className="memory-editor-content">
        <MakeItMemorable cardId={card.id} embedded hasMedia={hasMedia} onGenerated={onGenerated} />
      </div>
    </div>
  );
}
