import { expect, it } from "vitest";
import { dragHint, feedAction, knewIt } from "./feedGesture";

it("makes the learner look before moving on: a tap or swipe up on a hidden card only reveals it", () => {
  expect(feedAction(0, 0, 100, false)).toEqual({ kind: "reveal" });
  expect(feedAction(0, -200, 300, false)).toEqual({ kind: "reveal" });
  expect(feedAction(0, -400, 300, false)).toEqual({ kind: "reveal" });
  expect(feedAction(-200, 0, 300, false)).toEqual({ kind: "none" });
  expect(feedAction(200, 0, 300, false)).toEqual({ kind: "none" });
  expect(feedAction(0, 300, 300, false)).toEqual({ kind: "none" });
});

it("grades a revealed card sideways only: right is Got it, left is Forgot", () => {
  expect(feedAction(150, -10, 300, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(-150, 10, 300, true)).toEqual({ kind: "rate", rating: "again" });
  expect(feedAction(5, -150, 300, true)).toEqual({ kind: "none" });
  expect(feedAction(0, -400, 300, true)).toEqual({ kind: "none" });
  expect(feedAction(10, 300, 300, true)).toEqual({ kind: "none" });
});

it("ignores taps and short drags on a revealed card", () => {
  expect(feedAction(2, 3, 80, true)).toEqual({ kind: "none" });
  expect(feedAction(-40, 0, 400, true)).toEqual({ kind: "none" });
  expect(feedAction(40, 0, 400, true)).toEqual({ kind: "none" });
});

it("counts a quick short flick", () => {
  expect(feedAction(40, 0, 50, true)).toEqual({ kind: "rate", rating: "good" });
  expect(feedAction(-40, 0, 50, true)).toEqual({ kind: "rate", rating: "again" });
  expect(feedAction(0, -40, 50, false)).toEqual({ kind: "reveal" });
});

it("labels the drag before the finger lifts, and points the way when a drag would do nothing", () => {
  expect(dragHint(120, 0, true)).toEqual({ label: "Got it", rating: "good" });
  expect(dragHint(-120, 0, true)).toEqual({ label: "Forgot", rating: "again" });
  expect(dragHint(0, -120, true)).toEqual({ label: "Swipe left or right" });
  expect(dragHint(0, -120, false)).toEqual({ label: "Show the answer" });
  expect(dragHint(120, 0, false)).toEqual({ label: "Swipe up first" });
  expect(dragHint(0, 0, false)).toBeNull();
  expect(dragHint(30, 0, true)).toBeNull();
});

it("counts every rating but Forgot as knowing it", () => {
  expect(knewIt("again")).toBe(false);
  expect(["hard", "good", "easy"].map((r) => knewIt(r as "good"))).toEqual([true, true, true]);
});
