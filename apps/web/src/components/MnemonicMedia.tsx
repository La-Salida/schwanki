import { useEffect, useState, type ReactNode } from "react";
import { loadCardMedia, type LoadedMedia } from "@/lib/mnemonic";
import { frontRanges } from "@/lib/highlight";

function highlighted(text: string, ranges: Array<[number, number]>): ReactNode {
  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([start, end], i) => {
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(
      <mark key={i} className="bg-beak/5 px-0.5 font-black text-beak underline decoration-beak/50 decoration-2 underline-offset-4">
        {text.slice(start, end)}
      </mark>,
    );
    pos = end;
  });
  parts.push(text.slice(pos));
  return parts;
}

/** Renders the card's generated mnemonic content as part of the card back itself:
 * scene image, sentence with the target word/structure highlighted, translation, hook, and play. */
export function MnemonicMedia({ cardId, word, sourceExample, refreshKey }: { cardId: string; word: string; sourceExample?: string | undefined; refreshKey?: number }) {
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  useEffect(() => {
    let mounted = true;
    loadCardMedia(cardId).then((m) => { if (mounted) setMedia(m); }).catch(() => { if (mounted) setMedia({}); });
    return () => { mounted = false; };
  }, [cardId, refreshKey]);
  if (!media) return sourceExample ? <p className="mt-3 text-ink/70">{sourceExample}</p> : null;
  if (!media.sentence && !media.imageUrl && !media.audioUrl) return sourceExample ? <p className="mt-3 text-ink/70">{sourceExample}</p> : null;
  const ranges = media.sentence ? frontRanges(media.sentence.text, word) : [];
  return (
    <div className="mx-auto mt-6 max-w-md space-y-3 border-t border-ink/10 pt-5 text-left">
      {media.imageUrl && (
        <img src={media.imageUrl} alt="mnemonic scene" className="mx-auto max-h-56 rounded-xl border-2 border-ink/10" />
      )}
      {media.sentence && (
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug">{highlighted(media.sentence.text, ranges)}</p>
            <p className="mt-0.5 text-sm text-ink/60">{media.sentence.translation}</p>
            {media.hook && <p className="mt-1 text-xs text-ink/40">your hook: {media.hook}</p>}
          </div>
          {media.audioUrl && (
            <button onClick={(e) => { e.stopPropagation(); void new Audio(media.audioUrl).play(); }}
              title="play pronunciation"
              aria-label="Play pronunciation"
              className="shrink-0 rounded-lg bg-beak px-3 py-1 text-sm font-bold text-cream">▶</button>
          )}
        </div>
      )}
      {!media.sentence && sourceExample && <p className="text-ink/70">{sourceExample}</p>}
      {media.audioUrl && !media.sentence && (
        <button onClick={(e) => { e.stopPropagation(); void new Audio(media.audioUrl).play(); }}
          aria-label="Play pronunciation"
          className="mx-auto block rounded-lg bg-beak px-3 py-1 text-sm font-bold text-cream">▶</button>
      )}
    </div>
  );
}
