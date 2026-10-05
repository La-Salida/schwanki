import { describe, it, expect } from "vitest";
import { groupByBatch } from "./groupCandidates";
import type { CandidateCardRow } from "@schwanki/core";

function mk(id: string, sourceId: string, createdAt: string): CandidateCardRow {
  return { id, sourceId, front: id, back: "b", rawContext: "", status: "pending", confidence: 0.9, createdAt };
}

describe("groupByBatch", () => {
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

it('keeps same-day classes separate and uses class time in the learner timezone',()=>{
 const groups=groupByBatch([
  {...mk('a','s','2026-10-06T00:00:00Z'),recordingId:'r1',classStartedAt:'2026-10-05T18:00:00Z'},
  {...mk('b','s','2026-10-06T00:00:00Z'),recordingId:'r2',classStartedAt:'2026-10-05T19:00:00Z'},
 ],'Asia/Bangkok');
 expect(groups).toHaveLength(2);expect(groups.map(g=>g.key)).toEqual(['class:r2','class:r1']);expect(groups[1]?.label).toBe('2026-10-06 01:00');
});
