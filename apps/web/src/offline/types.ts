import type { CardState, ReviewRating, SerializedFsrsCard } from "@schwanki/core";
export interface QueuedReview {
  state: CardState;
  event: { cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number };
}
