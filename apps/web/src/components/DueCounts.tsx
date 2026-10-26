import type { DueBucket } from "@schwanki/core";

const BUCKETS: Array<[DueBucket, string]> = [["new", "New"], ["learning", "Learning"], ["review", "Review"]];

/** Anki's New / Learning / Review counts. `current` underlines the bucket of the card on screen. */
export function DueCounts({ counts, current, compact = false }: { counts: Record<DueBucket, number>; current?: DueBucket; compact?: boolean }) {
  const summary = BUCKETS.map(([b, name]) => `${counts[b]} ${name.toLowerCase()}`).join(", ");
  return (
    <span className={`due-counts ${compact ? "due-counts-compact" : ""}`} role="img" aria-label={summary}>
      {BUCKETS.map(([b, name]) => (
        <span key={b} className={`due-count due-count-${b}`} data-current={current === b || undefined} title={name}>
          <span className="due-count-n">{counts[b]}</span>
          {!compact && <span className="due-count-name">{name}</span>}
        </span>
      ))}
    </span>
  );
}
