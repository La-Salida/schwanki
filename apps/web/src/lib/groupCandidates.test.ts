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
