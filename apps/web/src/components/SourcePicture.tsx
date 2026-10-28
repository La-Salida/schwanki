import { useEffect, useState } from "react";
import type { Source } from "@schwanki/core";
import { api } from "@/lib/supabase";

/** The class picture a source was read from: a thumbnail that opens the full screenshot. */
export function SourcePicture({ source, size = "md" }: { source: Source; size?: "sm" | "md" }) {
  // The content hash changes when "Replace picture" swaps the file, so the thumbnail follows it.
  const key = `${source.id}:${source.contentHash ?? ""}`;
  const [link, setLink] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    api.sourceFileUrl({ id: source.id, userId: source.userId })
      .then((url) => { if (live) setLink({ key, url }); })
      .catch(() => { if (live) setLink({ key, url: null }); });
    return () => { live = false; };
  }, [key, source.id, source.userId]);
  const box = size === "sm" ? "size-12" : "h-16 w-24";
  const current = link?.key === key ? link : null;
  if (!current) return <span aria-hidden="true" className={`${box} shrink-0 animate-pulse rounded-lg bg-ink/10 motion-reduce:animate-none`} />;
  if (!current.url) return null;
  return (
    <a href={current.url} target="_blank" rel="noreferrer" className={`${box} block shrink-0 overflow-hidden rounded-lg border border-ink/15 bg-white`}
      aria-label={`Open the picture for ${source.label}`}>
      <img src={current.url} alt="" loading="lazy" className="size-full object-cover" onError={() => setLink({ key, url: null })} />
    </a>
  );
}
