import type { DueCard } from "@schwanki/core";
import { db } from "./db";
import type { QueuedReview } from "./types";

export async function cacheDueCards(cards: DueCard[]): Promise<DueCard[]> {
  const d = await db();
  const tx = d.transaction(["due", "outbox"], "readwrite");
  const due = tx.objectStore("due");
  const previous = new Map((await due.getAll()).map((c: DueCard) => [c.card.id, c]));
  const merged = new Map(cards.map((c) => [c.card.id, c]));
  for (const [id, incoming] of merged) {
    const local = previous.get(id);
    if (local?.state?.lastReviewedAt &&
        new Date(local.state.lastReviewedAt).getTime() > new Date(incoming.state?.lastReviewedAt ?? 0).getTime()) {
      merged.set(id, { card: incoming.card, state: local.state });
    }
  }
  // A failed or concurrent flush must not replace newer local schedules.
  for (const review of await tx.objectStore("outbox").getAll() as QueuedReview[]) {
    const card = merged.get(review.state.cardId)?.card ?? previous.get(review.state.cardId)?.card;
    if (card) merged.set(card.id, { card, state: review.state });
  }
  await due.clear();
  for (const c of merged.values()) await due.put(c);
  await tx.done;
  return onlyDue([...merged.values()], new Date());
}

export async function loadCachedDueCards(now = new Date()): Promise<DueCard[]> {
  return onlyDue(await (await db()).getAll("due") as DueCard[], now);
}

function onlyDue(cards: DueCard[], now: Date): DueCard[] {
  return cards.filter((c) => !c.state || new Date(c.state.dueAt).getTime() <= now.getTime());
}
