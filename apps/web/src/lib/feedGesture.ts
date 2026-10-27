import type { ReviewRating } from "@schwanki/core";

/** What a finished drag on the phone feed means. */
export type FeedAction = { kind: "reveal" } | { kind: "rate"; rating: ReviewRating } | { kind: "none" };

const SWIPE = 70; // px a drag must travel to count
const FLICK = 0.5; // px/ms: a fast short flick counts too
const TAP = 10; // px a tap may wobble

/**
 * Two steps, one direction each, so the learner never has to remember a map:
 * hidden card: a tap or swipe up reveals it (you have to look before you move on);
 * revealed card: swipe right = Got it, swipe left = Forgot. Vertical drags never grade.
 */
export function feedAction(dx: number, dy: number, ms: number, revealed: boolean): FeedAction {
  const dist = Math.hypot(dx, dy);
  if (dist < TAP) return revealed ? { kind: "none" } : { kind: "reveal" };
  const speed = dist / Math.max(ms, 1);
  const far = (d: number) => d >= SWIPE || (d >= TAP * 2 && speed >= FLICK);
  const vertical = Math.abs(dy) >= Math.abs(dx);
  if (!revealed) return vertical && dy < 0 && far(-dy) ? { kind: "reveal" } : { kind: "none" };
  if (vertical) return { kind: "none" };
  if (dx > 0 && far(dx)) return { kind: "rate", rating: "good" };
  if (dx < 0 && far(-dx)) return { kind: "rate", rating: "again" };
  return { kind: "none" };
}

export const RATING_LABEL: Record<ReviewRating, string> = { again: "Forgot", hard: "Hard", good: "Got it", easy: "Easy" };

/** Did the learner know it? Hard still counts as a pass, as in Anki. */
export const knewIt = (rating: ReviewRating) => rating !== "again";

export interface DragHint { label: string; rating?: ReviewRating }

/** Label shown while the finger is still down, so the learner sees what letting go will do. */
export function dragHint(dx: number, dy: number, revealed: boolean): DragHint | null {
  const a = feedAction(dx, dy, 1000, revealed);
  if (a.kind === "reveal") return Math.hypot(dx, dy) >= TAP ? { label: "Show the answer" } : null;
  if (a.kind === "rate") return { label: RATING_LABEL[a.rating], rating: a.rating };
  // A drag that will do nothing says which way does something.
  if (Math.hypot(dx, dy) < SWIPE) return null;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  if (!revealed) return vertical ? null : { label: "Swipe up first" };
  return vertical ? { label: "Swipe left or right" } : null;
}
