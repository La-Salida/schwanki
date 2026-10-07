import { describe, it, expect } from "vitest";
import { groupByBatch } from "./groupCandidates";
import type { CandidateCardRow } from "@schwanki/core";

function mk(id: string, sourceId: string, createdAt: string): CandidateCardRow {
  return { id, sourceId, front: id, back: "b", rawContext: "", status: "pending", confidence: 0.9, createdAt };
}

describe("groupByBatch", () => {
  it('uses the class start and learner timezone even when extraction finishes next day', () => {
    const [group] = groupByBatch([{ ...mk('late', 'source', '2026-10-06T14:00:00Z'), recordingId: 'class-1',
      recordingStartedAt: '2026-10-05T20:30:00Z', recordingLabel: 'Thai with tutor' }], 'Asia/Bangkok');
    expect(group!.label).toContain('2026-10-06');
    expect(group!.label).toContain('03:30');
    expect(group!.label).toContain('Thai with tutor');
  });
  it('keeps same-day classes separate, even when their tutor and fronts match', () => {
    const date = '2026-10-05T10:00:00Z';
    const groups = groupByBatch([
      { ...mk('a', 'tutor', date), recordingId: 'class-1' },
      { ...mk('b', 'tutor', date), recordingId: 'class-2' },
      { ...mk('c', 'tutor', '2026-10-06T10:00:00Z'), recordingId: 'class-1' },
      { ...mk('legacy', 'tutor', date) },
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.find(g => g.key === 'class:class-1')!.items.map(i => i.id)).toEqual(['a', 'c']);
  });
  it('prefers a persisted batch over source/day for non-class candidates', () => {
    expect(groupByBatch([
      { ...mk('a', 'source', '2026-10-05T10:00:00Z'), batchId: 'batch-a' },
      { ...mk('b', 'source', '2026-10-05T10:00:00Z'), batchId: 'batch-b' },
    ])).toHaveLength(2);
  });
  it("groups by source + calendar date, newest first", () => {
    const groups = groupByBatch([
      mk("a", "s1", "2026-09-16T10:00:00Z"),
      mk("b", "s1", "2026-09-16T11:00:00Z"),
      mk("c", "s1", "2026-09-23T09:00:00Z"),
      mk("d", "s2", "2026-09-23T09:00:00Z"),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["c"]); // newest first
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["d"]); // different source = different batch
    expect(groups[2]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});
