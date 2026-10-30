import type { ReviewStore, ReviewPayload } from './storage';
export interface ReviewSaver { saveReview(state: ReviewPayload['state'], event: ReviewPayload['event']): Promise<void> }
export class ReviewSync {
  private active: Promise<number> | null = null;
  private requested = false;
  constructor(private store: ReviewStore, private userId: string, private api: ReviewSaver) {}
  flush(): Promise<number> {
    this.requested = true;
    if (this.active) return this.active;
    this.active = this.drain().finally(() => { this.active = null; });
    return this.active;
  }
  private async drain() {
    let count = 0;
    do {
      this.requested = false;
      for (;;) {
        const next = await this.store.head(this.userId);
        if (!next) break;
        try { await this.api.saveReview(next.payload.state, next.payload.event); }
        catch (error) {
          const failure = error as { code?: string; message?: string };
          if (failure.code === '23503' && /(?:card_state|review_events)_card_id_fkey/.test(failure.message ?? '')) {
            await this.store.discardDeletedCard(this.userId, next.payload.event.cardId);
            continue;
          }
          throw error;
        }
        await this.store.acknowledge(this.userId, next.seq);
        count++;
      }
    } while (this.requested);
    return count;
  }
}
export function studyDayStart(now = new Date()) {
  const date = new Date(now); date.setHours(4, 0, 0, 0);
  if (now < date) date.setDate(date.getDate() - 1);
  return date;
}
export function gestureAction(dx: number, dy: number, revealed: boolean): 'reveal' | 'again' | 'easy' | 'good' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 65) return null;
  if (!revealed) return dy < -65 && Math.abs(dy) > Math.abs(dx) ? 'reveal' : null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'again' : 'easy';
  return dy < 0 ? 'good' : null;
}
