import type { ReviewRating } from "@schwanki/core";

/** What a finished drag on the phone feed means. */
export type FeedAction = { kind: "reveal" } | { kind: "rate"; rating: ReviewRating } | { kind: "none" };

const SWIPE = 70; // px a drag must travel to count
const FLICK = 0.5; // px/ms: a fast short flick counts too
const TAP = 10; // px a tap may wobble

/**
 * Hidden card: a tap or swipe up reveals it (you have to look before you move on).
 * Revealed card: swipe up = Got it, swipe left = Forgot, swipe right = Too easy.
 */
export function feedAction(dx: number, dy: number, ms: number, revealed: boolean): FeedAction {
  const dist = Math.hypot(dx, dy);
  if (dist < TAP) return revealed ? { kind: "none" } : { kind: "reveal" };
  const speed = dist / Math.max(ms, 1);
  const far = (d: number) => d >= SWIPE || (d >= TAP * 2 && speed >= FLICK);
  const vertical = Math.abs(dy) >= Math.abs(dx);
  if (vertical) {
    if (dy < 0 && far(-dy)) return revealed ? { kind: "rate", rating: "good" } : { kind: "reveal" };
    return { kind: "none" };
  }
  if (!revealed) return { kind: "none" };
  if (dx < 0 && far(-dx)) return { kind: "rate", rating: "again" };
  if (dx > 0 && far(dx)) return { kind: "rate", rating: "easy" };
  return { kind: "none" };
}

/** Label shown while the finger is still down, so the learner sees what letting go will do. */
export function dragHint(dx: number, dy: number, revealed: boolean): string | null {
  const a = feedAction(dx, dy, 1000, revealed);
  if (a.kind === "reveal" && Math.hypot(dx, dy) >= TAP) return "Show meaning";
  if (a.kind !== "rate") return null;
  return a.rating === "good" ? "Got it" : a.rating === "again" ? "Forgot" : "Too easy";
}
