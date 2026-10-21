import type { CardState, ReviewRating, SerializedFsrsCard } from "@schwanki/core";
export interface QueuedReview {
  state: CardState;
  event: { id?: string; cardId: string; rating: ReviewRating; reviewedAt: string; fsrsStateBefore: SerializedFsrsCard; elapsedMs?: number };
}
