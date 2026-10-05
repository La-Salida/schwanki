import type { CandidateCardRow } from "@schwanki/core";

export interface Batch { key: string; label: string; sourceId: string; items: CandidateCardRow[]; sortTime: number }

export function groupByBatch(candidates: CandidateCardRow[], timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): Batch[] {
  const map = new Map<string, Batch>();
  for (const c of candidates) {
    const day = c.createdAt.slice(0, 10);
    const key = c.recordingId ? `class:${c.recordingId}` : c.batchId ? `batch:${c.batchId}` : `${c.sourceId}:${day}`;
    const instant = c.recordingStartedAt ?? c.createdAt;
    const localClassTime = c.recordingId ? new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(instant)) : day;
    const label = c.recordingId ? `${c.recordingLabel ?? 'Class'} · ${localClassTime}` : day;
    const batch = map.get(key) ?? { key, label, sourceId: c.sourceId, items: [], sortTime: Date.parse(instant) };
    batch.items.push(c);
    map.set(key, batch);
  }
  return [...map.values()].sort((a, b) => b.sortTime - a.sortTime);
}
