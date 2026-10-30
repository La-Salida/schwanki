import {
  FSRS,
  Rating,
  State,
  createEmptyCard,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { ReviewRating, SerializedFsrsCard } from "./types.ts";

const engine = new FSRS(generatorParameters({ enable_fuzz: true }));
// Replaying a history must give the same state every time, so no fuzz.
const replayEngine = new FSRS(generatorParameters({ enable_fuzz: false }));

const RATING_MAP: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function serialize(card: FsrsCard): SerializedFsrsCard {
  return JSON.parse(
    JSON.stringify(card, (_k, v) => (v instanceof Date ? v.toISOString() : v)),
  );
}

function deserialize(raw: SerializedFsrsCard): FsrsCard {
  const card = { ...raw } as Record<string, unknown>;
  if (typeof card.due === "string") card.due = new Date(card.due);
  if (typeof card.last_review === "string") card.last_review = new Date(card.last_review);
  return card as unknown as FsrsCard;
}

export function initCardState(now: Date): { dueAt: Date; fsrs: SerializedFsrsCard } {
  const card = createEmptyCard(now);
  return { dueAt: card.due, fsrs: serialize(card) };
}

export function scheduleReview(
  fsrs: SerializedFsrsCard,
  rating: ReviewRating,
  now: Date,
): { dueAt: Date; stability: number; difficulty: number; reps: number; lapses: number; fsrs: SerializedFsrsCard } {
  const card = deserialize(fsrs);
  const scheduled = engine.repeat(card, now);
  const item = scheduled[RATING_MAP[rating]];
  const next = item.card;
  return {
    dueAt: next.due,
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    fsrs: serialize(next),
  };
}

export function isDue(fsrs: SerializedFsrsCard, now: Date): boolean {
  return deserialize(fsrs).due.getTime() <= now.getTime();
}

export interface ScheduledState {
  dueAt: Date;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date | null;
  fsrs: SerializedFsrsCard;
}

function toScheduled(card: FsrsCard): ScheduledState {
  return {
    dueAt: card.due, stability: card.stability, difficulty: card.difficulty,
    reps: card.reps, lapses: card.lapses, lastReviewedAt: card.last_review ?? null, fsrs: serialize(card),
  };
}

/** A new card that becomes due at `dueAt` (imported decks pace new cards out over days). */
export function newCardState(dueAt: Date): ScheduledState {
  return toScheduled(createEmptyCard(dueAt));
}

/**
 * Rebuild a card's FSRS state by replaying its past reviews, oldest first.
 * Used when importing review history from another app (Anki). Null when there are none.
 */
export function stateFromHistory(reviews: Array<{ at: Date; rating: ReviewRating }>): ScheduledState | null {
  if (reviews.length === 0) return null;
  const ordered = reviews.slice().sort((a, b) => a.at.getTime() - b.at.getTime());
  let card = createEmptyCard(ordered[0]!.at);
  for (const review of ordered) {
    // Reviews logged out of order or at the same instant still count; time never runs backwards.
    const at = card.last_review && review.at < card.last_review ? card.last_review : review.at;
    card = replayEngine.next(card, at, RATING_MAP[review.rating]).card;
  }
  return toScheduled(card);
}

/** Preserve the imported log with the deterministic scheduler's actual before-state. */
export function importedReviewHistory(reviews: Array<{ at: Date; rating: ReviewRating }>) {
  const ordered = reviews.slice().sort((a, b) => a.at.getTime() - b.at.getTime());
  let card = createEmptyCard(ordered[0]?.at ?? new Date(0));
  return ordered.map((review) => {
    const at = card.last_review && review.at < card.last_review ? card.last_review : review.at;
    const event = { reviewedAt: at.toISOString(), rating: review.rating, fsrsStateBefore: serialize(card) };
    card = replayEngine.next(card, at, RATING_MAP[review.rating]).card;
    return event;
  });
}

/**
 * Best guess at FSRS state from an interval alone, for cards whose review history
 * wasn't exported: memory lasts about as long as the interval the old app chose.
 */
export function stateFromInterval(input: {
  lastReviewedAt: Date; intervalDays: number; reps: number; lapses: number; dueAt?: Date;
}): ScheduledState {
  const days = Math.max(1, input.intervalDays);
  const due = input.dueAt ?? new Date(input.lastReviewedAt.getTime() + days * 86_400_000);
  return toScheduled({
    due, stability: days, difficulty: 5, elapsed_days: 0, scheduled_days: days,
    reps: Math.max(1, input.reps), lapses: input.lapses, state: State.Review, last_review: input.lastReviewedAt,
  });
}
