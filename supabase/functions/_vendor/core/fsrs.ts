// GENERATED from packages/core/src/fsrs.ts — edit the source, then re-run scripts/vendor-edge.sh
import {
  FSRS,
  Rating,
  createEmptyCard,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { ReviewRating, SerializedFsrsCard } from "./types.ts";

const engine = new FSRS(generatorParameters({ enable_fuzz: true }));

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
