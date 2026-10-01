import { describe, it, expect } from "vitest";
import { groupReviewStats } from "./api.ts";

const NOW = "2026-10-01T12:00:00.000Z";
const row = (over: Partial<Record<string, unknown>>) => ({
  id: "c", source_id: "s1", language: "zh", card_state: null, ...over,
});

describe("groupReviewStats", () => {
  it("groups by source with due/new/not-yet-due split", () => {
    const groups = groupReviewStats([
      row({ id: "1", card_state: { due_at: "2026-10-01T10:00:00Z" } }), // overdue
      row({ id: "2", card_state: { due_at: "2026-10-01T11:59:59Z" } }), // due (boundary)
      row({ id: "3", card_state: { due_at: "2026-10-01T12:00:01Z" } }), // not yet
      row({ id: "4", card_state: null }), // fresh → counts as due
      row({ id: "5", source_id: "s2", language: "ko", card_state: { due_at: "2026-09-01T00:00:00Z" } }),
      row({ id: "6", source_id: null, language: "en", card_state: null }), // manual group
    ], NOW);
    const byKey = new Map(groups.map((g) => [`${g.sourceId}|${g.language}`, g]));
    expect(byKey.get("s1|zh")).toEqual({ sourceId: "s1", language: "zh", total: 4, due: 3, fresh: 1 });
    expect(byKey.get("s2|ko")).toEqual({ sourceId: "s2", language: "ko", total: 1, due: 1, fresh: 0 });
    expect(byKey.get("null|en")).toEqual({ sourceId: null, language: "en", total: 1, due: 1, fresh: 1 });
  });
  it("array-shaped card_state (PostgREST embeds) is handled", () => {
    const groups = groupReviewStats([row({ card_state: [{ due_at: "2026-10-02T00:00:00Z" }] })], NOW);
    expect(groups[0]).toMatchObject({ total: 1, due: 0, fresh: 0 });
  });
  it("empty input → no groups", () => {
    expect(groupReviewStats([], NOW)).toEqual([]);
  });
});
