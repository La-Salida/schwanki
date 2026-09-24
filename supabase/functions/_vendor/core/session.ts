// GENERATED from packages/core/src/session.ts — edit the source, then re-run scripts/vendor-edge.sh
import { initCardState, scheduleReview } from "./fsrs.ts";
import type { CardState, ReviewRating, SchwankiCard, SerializedFsrsCard } from "./types.ts";

export interface DueCard {
  card: SchwankiCard;
  state: CardState | null; // null = never reviewed
}

/** Overdue/learning cards first (oldest dueAt), new cards last. Limit defaults to 50. */
export function buildSessionQueue(due: DueCard[], _now: Date, limit = 50): DueCard[] {
  const withState = due
    .filter((d) => d.state !== null)
    .sort((a, b) => a.state!.dueAt.localeCompare(b.state!.dueAt));
  const fresh = due.filter((d) => d.state === null);
  return [...withState, ...fresh].slice(0, limit);
}

export function applyReview(
  dueCard: DueCard,
  rating: ReviewRating,
  now: Date,
): {
  state: CardState;
  event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard };
} {
  const before: SerializedFsrsCard =
    dueCard.state?.fsrs ?? initCardState(now).fsrs;
  const next = scheduleReview(before, rating, now);
  return {
    state: {
      cardId: dueCard.card.id,
      dueAt: next.dueAt.toISOString(),
      stability: next.stability,
      difficulty: next.difficulty,
      reps: next.reps,
      lapses: next.lapses,
      fsrs: next.fsrs,
      lastReviewedAt: now.toISOString(),
    },
    event: {
      cardId: dueCard.card.id,
      rating,
      reviewedAt: now.toISOString(),
      fsrsStateBefore: before,
    },
  };
}
