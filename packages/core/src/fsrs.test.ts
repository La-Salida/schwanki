import { describe, it, expect } from "vitest";
import { initCardState, scheduleReview, isDue, stateFromHistory, stateFromInterval, newCardState, importedReviewHistory } from "./fsrs.ts";

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

describe("imported history", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 9));

  it("returns null without reviews", () => {
    expect(stateFromHistory([])).toBeNull();
  });

  it("replays reviews into a card that is due later the more it was remembered", () => {
    const weak = stateFromHistory([{ at: day(0), rating: "good" }, { at: day(1), rating: "again" }])!;
    const strong = stateFromHistory([{ at: day(0), rating: "good" }, { at: day(1), rating: "good" }, { at: day(4), rating: "good" }])!;
    expect(strong.reps).toBe(3);
    expect(strong.lastReviewedAt).toEqual(day(4));
    expect(strong.stability).toBeGreaterThan(weak.stability);
    expect(strong.dueAt.getTime()).toBeGreaterThan(day(4).getTime());
  });

  it("is order independent and deterministic", () => {
    const reviews = [{ at: day(3), rating: "good" as const }, { at: day(0), rating: "good" as const }];
    expect(stateFromHistory(reviews)).toEqual(stateFromHistory(reviews.slice().reverse()));
  });

  it("imports each log with its actual before-state in chronological order", () => {
    const reviews = [{ at: day(3), rating: "easy" as const }, { at: day(0), rating: "good" as const }];
    const log = importedReviewHistory(reviews);
    expect(log.map(event => event.reviewedAt)).toEqual([day(0).toISOString(), day(3).toISOString()]);
    expect(log[0]!.fsrsStateBefore.reps).toBe(0);
    expect(log[1]!.fsrsStateBefore).toEqual(stateFromHistory([reviews[1]!])!.fsrs);
    expect(importedReviewHistory(reviews.slice().reverse())).toEqual(log);
    expect(importedReviewHistory([])).toEqual([]);
  });

  it("the replayed state keeps scheduling normally", () => {
    const s = stateFromHistory([{ at: day(0), rating: "good" }, { at: day(2), rating: "good" }])!;
    const next = scheduleReview(s.fsrs, "good", s.dueAt);
    expect(next.dueAt.getTime()).toBeGreaterThan(s.dueAt.getTime());
  });

  it("guesses state from an interval when history is missing", () => {
    const s = stateFromInterval({ lastReviewedAt: day(0), intervalDays: 30, reps: 5, lapses: 1, dueAt: day(30) });
    expect(s.stability).toBe(30);
    expect(s.dueAt).toEqual(day(30));
    expect(isDue(s.fsrs, day(29))).toBe(false);
    expect(isDue(s.fsrs, day(30))).toBe(true);
    expect(scheduleReview(s.fsrs, "good", day(30)).dueAt.getTime()).toBeGreaterThan(day(30).getTime());
  });

  it("new imported cards wait until their day", () => {
    const s = newCardState(day(3));
    expect(isDue(s.fsrs, day(2))).toBe(false);
    expect(s.reps).toBe(0);
  });
});
