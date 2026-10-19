import { expect, it } from "vitest";
import { dragHint, feedAction } from "./feedGesture";

it("makes the learner look before moving on: a tap or swipe up on a hidden card only reveals it", () => {
  expect(feedAction(0, 0, 100, false)).toEqual({ kind: "reveal" });
  expect(feedAction(0, -200, 300, false)).toEqual({ kind: "reveal" });
  expect(feedAction(-200, 0, 300, false)).toEqual({ kind: "none" });
});

it("grades a revealed card by swipe direction", () => {
  expect(feedAction(5, -150, 300, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(-150, 10, 300, true)).toEqual({ kind: "rate", rating: "again" });
  expect(feedAction(150, -10, 300, true)).toEqual({ kind: "rate", rating: "easy" });
});

it("ignores taps, short drags and downward drags on a revealed card", () => {
  expect(feedAction(2, 3, 80, true)).toEqual({ kind: "none" });
  expect(feedAction(0, -40, 400, true)).toEqual({ kind: "none" });
  expect(feedAction(0, 200, 300, true)).toEqual({ kind: "none" });
});

it("counts a quick short flick", () => {
  expect(feedAction(0, -40, 50, true)).toEqual({ kind: "rate", rating: "good" });
});

it("labels the drag before the finger lifts", () => {
  expect(dragHint(0, -120, true)).toBe("Got it");
  expect(dragHint(-120, 0, true)).toBe("Forgot");
  expect(dragHint(0, -120, false)).toBe("Show meaning");
  expect(dragHint(0, 0, false)).toBeNull();
});
