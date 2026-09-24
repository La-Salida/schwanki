import type { CandidateCardRow } from "@schwanki/core";

export interface Batch { key: string; label: string; sourceId: string; items: CandidateCardRow[] }

export function groupByBatch(candidates: CandidateCardRow[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const c of candidates) {
    const day = c.createdAt.slice(0, 10);
    const key = `${c.sourceId}:${day}`;
    const batch = map.get(key) ?? { key, label: day, sourceId: c.sourceId, items: [] };
    batch.items.push(c);
    map.set(key, batch);
  }
  return [...map.values()].sort((a, b) => b.label.localeCompare(a.label));
}
