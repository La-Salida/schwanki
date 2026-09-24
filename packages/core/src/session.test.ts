import { describe, it, expect } from "vitest";
import { buildSessionQueue, applyReview, type DueCard } from "./session";
import { initCardState, scheduleReview } from "./fsrs";
import type { SchwankiCard, CardState } from "./types";

const NOW = new Date("2026-09-24T10:00:00Z");

function mkCard(id: string): SchwankiCard {
  return { id, userId: "u1", sourceId: null, language: "zh", front: `w${id}`, back: "t", createdAt: NOW.toISOString() };
}

function mkDue(id: string, dueAt: Date): DueCard {
  const { fsrs } = initCardState(NOW);
  const state: CardState = {
    cardId: id, dueAt: dueAt.toISOString(), stability: 1, difficulty: 5,
    reps: 1, lapses: 0, fsrs, lastReviewedAt: NOW.toISOString(),
  };
  return { card: mkCard(id), state };
}

describe("buildSessionQueue", () => {
  it("orders: overdue first by dueAt, then new cards; respects limit", () => {
    const old = mkDue("old", new Date("2026-09-20T10:00:00Z"));
    const recent = mkDue("recent", new Date("2026-09-24T09:00:00Z"));
    const fresh: DueCard = { card: mkCard("new"), state: null };
    const queue = buildSessionQueue([fresh, recent, old], NOW, 50);
    expect(queue.map((d) => d.card.id)).toEqual(["old", "recent", "new"]);
    expect(buildSessionQueue([old, recent, fresh], NOW, 2)).toHaveLength(2);
  });
});

describe("applyReview", () => {
  it("new card: creates state and event with the pre-review fsrs snapshot", () => {
    const fresh: DueCard = { card: mkCard("c1"), state: null };
    const { state, event } = applyReview(fresh, "good", NOW);
    expect(state.cardId).toBe("c1");
    expect(state.reps).toBe(1);
    expect(event.rating).toBe("good");
    expect(event.cardId).toBe("c1");
    expect(event.fsrsStateBefore).toBeDefined();
  });

  it("existing card: advances scheduling", () => {
    const { fsrs } = initCardState(NOW);
    const grown = scheduleReview(fsrs, "good", NOW);
    const due = mkDue("c2", NOW);
    due.state!.fsrs = grown.fsrs;
    const { state } = applyReview(due, "easy", new Date("2026-09-25T10:00:00Z"));
    expect(state.reps).toBe(2);
  });
});
