import { useEffect, useState } from "react";
import { loadCardMedia, type LoadedMedia } from "@/lib/mnemonic";

export function MnemonicMedia({ cardId, refreshKey }: { cardId: string; refreshKey?: number }) {
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  useEffect(() => {
    let mounted = true;
    loadCardMedia(cardId).then((m) => { if (mounted) setMedia(m); }).catch(() => {});
    return () => { mounted = false; };
  }, [cardId, refreshKey]);
  if (!media || (!media.sentence && !media.imageUrl && !media.audioUrl)) return null;
  return (
    <div className="mt-4 space-y-3 rounded-2xl border-2 border-dashed border-ink/10 p-4 text-left">
      {media.imageUrl && <img src={media.imageUrl} alt="mnemonic scene" className="mx-auto w-48 rounded-xl" />}
      {media.sentence && (
        <div className="flex items-start gap-2">
          <div>
            <p className="font-bold">{media.sentence.text}</p>
            <p className="text-sm text-ink/60">{media.sentence.translation}</p>
            {media.hook && <p className="mt-1 text-xs text-ink/40">your hook: {media.hook}</p>}
          </div>
          {media.audioUrl && (
            <button onClick={() => void new Audio(media.audioUrl).play()}
              className="ml-auto rounded-lg bg-beak px-3 py-1 text-sm font-bold text-cream">▶</button>
          )}
        </div>
      )}
    </div>
  );
}
