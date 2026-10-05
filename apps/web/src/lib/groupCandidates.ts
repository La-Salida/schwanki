import type { CandidateCardRow } from "@schwanki/core";

export interface Batch { key: string; label: string; sourceId: string; items: CandidateCardRow[]; recordingId?: string }

export function groupByBatch(candidates: CandidateCardRow[], timeZone?: string): Batch[] {
  const map = new Map<string, Batch>();
  for (const c of candidates) {
    const classTime = new Date(c.classStartedAt ?? c.createdAt);
    const day = c.recordingId
      ? new Intl.DateTimeFormat("sv-SE", { ...(timeZone ? { timeZone } : {}), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(classTime)
      : c.createdAt.slice(0, 10);
    const key = c.recordingId ? `class:${c.recordingId}` : `${c.sourceId}:${day}`;
    const batch: Batch = map.get(key) ?? { key, label: day, sourceId: c.sourceId, items: [], ...(c.recordingId ? { recordingId: c.recordingId } : {}) };
    batch.items.push(c);
    map.set(key, batch);
  }
  return [...map.values()].sort((a, b) => b.label.localeCompare(a.label));
}
