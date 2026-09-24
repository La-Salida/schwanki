import { describe, it, expect } from "vitest";
import { initCardState, scheduleReview, isDue } from "./fsrs";

describe("fsrs wrapper", () => {
  it("new cards are due immediately", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    expect(isDue(fsrs, now)).toBe(true);
  });

  it("rating 'good' pushes due_at into the future", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    const next = scheduleReview(fsrs, "good", now);
    expect(next.dueAt.getTime()).toBeGreaterThan(now.getTime());
    expect(next.reps).toBe(1);
  });

  it("'again' reschedules sooner than 'easy'", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const { fsrs } = initCardState(now);
    const again = scheduleReview(fsrs, "again", now);
    const easy = scheduleReview(fsrs, "easy", now);
    expect(again.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
  });

  it("state round-trips through serialization", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    const first = scheduleReview(initCardState(now).fsrs, "good", now);
    const revived = JSON.parse(JSON.stringify(first.fsrs));
    const second = scheduleReview(revived, "good", first.dueAt);
    expect(second.reps).toBe(2);
  });
});
