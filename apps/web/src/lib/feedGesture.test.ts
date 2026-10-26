import { expect, it } from "vitest";
import { dragHint, feedAction } from "./feedGesture";

it("makes the learner look before moving on: a tap or swipe up on a hidden card only reveals it", () => {
  expect(feedAction(0, 0, 100, false)).toEqual({ kind: "reveal" });
  expect(feedAction(0, -200, 300, false)).toEqual({ kind: "reveal" });
  expect(feedAction(0, -400, 300, false)).toEqual({ kind: "reveal" });
  expect(feedAction(-200, 0, 300, false)).toEqual({ kind: "none" });
  expect(feedAction(0, 300, 300, false)).toEqual({ kind: "none" });
});

it("grades a revealed card: right or up is Got it, left is Hard", () => {
  expect(feedAction(150, -10, 300, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(5, -150, 300, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(-150, 10, 300, true)).toEqual({ kind: "rate", rating: "hard" });
});

it("needs a long swipe for Easy (up) and Forgot (down)", () => {
  expect(feedAction(0, -220, 300, true)).toEqual({ kind: "rate", rating: "easy" });
  expect(feedAction(10, 220, 300, true)).toEqual({ kind: "rate", rating: "again" });
  // A fast short flick stays a plain swipe, whatever its speed.
  expect(feedAction(0, -120, 40, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(0, 120, 40, true)).toEqual({ kind: "none" });
});

it("ignores taps and short drags on a revealed card", () => {
  expect(feedAction(2, 3, 80, true)).toEqual({ kind: "none" });
  expect(feedAction(0, -40, 400, true)).toEqual({ kind: "none" });
  expect(feedAction(-40, 0, 400, true)).toEqual({ kind: "none" });
});

it("counts a quick short flick", () => {
  expect(feedAction(0, -40, 50, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(40, 0, 50, true)).toEqual({ kind: "rate", rating: "good" });
});

it("labels the drag before the finger lifts, including where a longer swipe leads", () => {
  expect(dragHint(0, -120, true)).toEqual({ label: "Got it", rating: "good", more: "↑ further for Easy" });
  expect(dragHint(0, -240, true)).toEqual({ label: "Easy", rating: "easy" });
  expect(dragHint(120, 0, true)).toEqual({ label: "Got it", rating: "good" });
  expect(dragHint(-120, 0, true)).toEqual({ label: "Hard", rating: "hard" });
  expect(dragHint(0, 100, true)).toEqual({ label: "Keep going", more: "↓ for Forgot" });
  expect(dragHint(0, 240, true)).toEqual({ label: "Forgot", rating: "again" });
  expect(dragHint(0, -120, false)).toEqual({ label: "Show meaning" });
  expect(dragHint(0, 0, false)).toBeNull();
});
