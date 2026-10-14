import type { Source, SourceSyncProgress } from "@schwanki/core";

export type RowSync =
  | { phase: "syncing"; text: string }
  | { phase: "parsing"; text: string }
  | { phase: "idle"; text: string; tone: "quiet" | "alert" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What a class notes row says about its sync: fetching the file, reading words
 * from it, done with how many new words it found, or what went wrong.
 * `pressed` is a sync this page started and is still waiting on.
 */
export function rowSync(source: Source, progress: SourceSyncProgress | undefined, pressed: boolean): RowSync {
  if (source.status === "revoked") {
    return { phase: "idle", tone: "alert", text: "Schwanki lost access to this Google file. Reconnect Google to sync it again." };
  }
  if (pressed || progress?.syncing) return { phase: "syncing", text: "Syncing… fetching the latest notes" };
  if (progress?.parseStatus === "pending") return { phase: "parsing", text: "Synced. Waiting to read new words…" };
  if (progress?.parseStatus === "running") return { phase: "parsing", text: "Reading new words from these notes…" };
  if (source.status === "error") {
    return { phase: "idle", tone: "alert", text: `Sync failed: ${source.errorDetail ?? "unknown"}. Try syncing again.` };
  }
  if (!source.lastSyncedAt) return { phase: "idle", tone: "quiet", text: "Never synced" };
  const synced = `Synced ${new Date(source.lastSyncedAt).toLocaleDateString()}`;
  // A word count belongs to the latest sync only when its parse finished after that sync.
  const words = progress?.parseStatus === "done" && progress.parseFinishedAt
    && Date.parse(progress.parseFinishedAt) >= Date.parse(source.lastSyncedAt) ? progress.wordsFound : undefined;
  if (words === undefined) return { phase: "idle", tone: "quiet", text: synced };
  return { phase: "idle", tone: "quiet", text: words === 0 ? `${synced} · no new words` : `${synced} · ${plural(words, "new word")} sent to the Inbox` };
}
