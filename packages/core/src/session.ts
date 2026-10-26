import { State } from "ts-fsrs";
import { initCardState, scheduleReview } from "./fsrs.ts";
import type { CardState, ReviewRating, SchwankiCard, SerializedFsrsCard } from "./types.ts";

export interface DueCard {
  card: SchwankiCard;
  state: CardState | null; // null = never reviewed
}

/** Anki's three due buckets: never studied, still being learned (or relearned), and graduated. */
export type DueBucket = "new" | "learning" | "review";

export function dueBucket(d: DueCard): DueBucket {
  if (d.state === null) return "new";
  const s = d.state.fsrs.state;
  if (s === State.New) return "new";
  if (s === State.Learning || s === State.Relearning) return "learning";
  if (s === State.Review) return "review";
  // Older rows without an FSRS state: judge by whether it was ever reviewed.
  return d.state.reps > 0 ? "review" : "new";
}

export function bucketCounts(due: DueCard[]): Record<DueBucket, number> {
  const counts = { new: 0, learning: 0, review: 0 };
  for (const d of due) counts[dueBucket(d)]++;
  return counts;
}

/**
 * Anki's order: cards being learned first, then reviews, then new cards; oldest due first
 * within each, new cards that never got a state row last. Limit defaults to 50.
 */
export function buildSessionQueue(due: DueCard[], _now: Date, limit = 50): DueCard[] {
  const byDue = (a: DueCard, b: DueCard) =>
    a.state === null ? (b.state === null ? 0 : 1) : b.state === null ? -1 : a.state.dueAt.localeCompare(b.state.dueAt);
  const order: DueBucket[] = ["learning", "review", "new"];
  return order.flatMap((bucket) => due.filter((d) => dueBucket(d) === bucket).sort(byDue)).slice(0, limit);
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
