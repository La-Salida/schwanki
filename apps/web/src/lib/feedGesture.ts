import type { ReviewRating } from "@schwanki/core";

/** What a finished drag on the phone feed means. */
export type FeedAction = { kind: "reveal" } | { kind: "rate"; rating: ReviewRating } | { kind: "none" };

const SWIPE = 70; // px a drag must travel to count
const FLICK = 0.5; // px/ms: a fast short flick counts too
const TAP = 10; // px a tap may wobble
/** px an up or down drag must travel for Easy or Forgot. Distance only, so a quick
 * doomscroll flick stays Got it and a learner can see the switch happen before letting go. */
export const SUPER = 200;

/**
 * Hidden card: a tap or swipe up reveals it (you have to look before you move on).
 * Revealed card: swipe right or up = Got it, swipe left = Hard,
 * a long swipe up = Easy, a long swipe down = Forgot.
 */
export function feedAction(dx: number, dy: number, ms: number, revealed: boolean): FeedAction {
  const dist = Math.hypot(dx, dy);
  if (dist < TAP) return revealed ? { kind: "none" } : { kind: "reveal" };
  const speed = dist / Math.max(ms, 1);
  const far = (d: number) => d >= SWIPE || (d >= TAP * 2 && speed >= FLICK);
  const vertical = Math.abs(dy) >= Math.abs(dx);
  if (vertical) {
    if (!revealed) return dy < 0 && far(-dy) ? { kind: "reveal" } : { kind: "none" };
    if (dy <= -SUPER) return { kind: "rate", rating: "easy" };
    if (dy >= SUPER) return { kind: "rate", rating: "again" };
    if (dy < 0 && far(-dy)) return { kind: "rate", rating: "good" };
    return { kind: "none" };
  }
  if (!revealed) return { kind: "none" };
  if (dx > 0 && far(dx)) return { kind: "rate", rating: "good" };
  if (dx < 0 && far(-dx)) return { kind: "rate", rating: "hard" };
  return { kind: "none" };
}

export const RATING_LABEL: Record<ReviewRating, string> = { again: "Forgot", hard: "Hard", good: "Got it", easy: "Easy" };

export interface DragHint { label: string; rating?: ReviewRating; more?: string }

/** Label shown while the finger is still down, so the learner sees what letting go will do. */
export function dragHint(dx: number, dy: number, revealed: boolean): DragHint | null {
  const a = feedAction(dx, dy, 1000, revealed);
  if (a.kind === "reveal") return Math.hypot(dx, dy) >= TAP ? { label: "Show meaning" } : null;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  if (a.kind !== "rate") {
    // Heading down but not far enough yet: say what's at the end of it.
    return revealed && vertical && dy >= SWIPE ? { label: "Keep going", more: "↓ for Forgot" } : null;
  }
  const hint: DragHint = { label: RATING_LABEL[a.rating], rating: a.rating };
  if (a.rating === "good" && vertical) hint.more = "↑ further for Easy";
  return hint;
}
