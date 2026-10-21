import { db } from "./db";
import type { QueuedReview } from "./types";
import type { SchwankiCard } from "@schwanki/core";

/** The outbox and local schedule commit together before the next card appears. */
export async function queueReview(payload: QueuedReview, card?: SchwankiCard): Promise<void> {
  const tx = (await db()).transaction(["outbox", "due"], "readwrite");
  const cached = await tx.objectStore("due").get(payload.state.cardId);
  await tx.objectStore("outbox").add({ ...payload, event: { ...payload.event, id: payload.event.id ?? crypto.randomUUID() } });
  if (card || cached) {
    await tx.objectStore("due").put({ card: card ?? cached.card, state: payload.state });
  }
  await tx.done;
}

export async function hasQueuedReviews(): Promise<boolean> {
  return (await (await db()).count("outbox")) > 0;
}

interface ReviewSaver { saveReview: (state: QueuedReview["state"], event: QueuedReview["event"]) => Promise<void> }

let activeFlush: Promise<number> | null = null;

/** Flush in FIFO order; stop at first failure so nothing is lost or reordered. Returns count flushed. */
export async function flushOutbox(api: ReviewSaver): Promise<number> {
  if (activeFlush) {
    await activeFlush;
    return flushOutbox(api); // a rating may have arrived after the active pass read its last item
  }
  activeFlush = drainOutbox(api);
  try {
    return await activeFlush;
  } finally {
    activeFlush = null;
  }
}

async function drainOutbox(api: ReviewSaver): Promise<number> {
  const d = await db();
  let flushed = 0;
  while (true) {
    // Read the head in a short tx, close it, then await the network
    // OUTSIDE any transaction — otherwise the tx deactivates during the save
    // and the delete below would throw TransactionInactiveError.
    const readTx = d.transaction("outbox", "readwrite");
    const cursor = await readTx.store.openCursor();
    const item = cursor?.value as QueuedReview | undefined;
    // Upgrade reviews queued by older app versions before making any network request.
    if (item && !item.event.id) {
      item.event.id = crypto.randomUUID();
      await cursor!.update(item);
    }
    await readTx.done;
    if (!cursor || !item) break;
    const key = cursor.primaryKey;
    try {
      await api.saveReview(item.state, item.event);
    } catch (error) {
      // A card deleted on another device can no longer accept a rating. Do not
      // let its foreign-key failure permanently block every later review.
      const failure = error as { code?: string; message?: string } | null;
      if (failure?.code === "23503" && /(?:card_state|review_events)_card_id_fkey/.test(failure.message ?? "")) {
        const tx = d.transaction(["due", "outbox"], "readwrite");
        await tx.objectStore("due").delete(item.state.cardId);
        await tx.objectStore("outbox").delete(key);
        await tx.done;
        continue;
      }
      break; // keep the item queued; retry head-of-line next flush
    }
    await d.delete("outbox", key); // fresh short readwrite tx
    flushed++;
  }
  return flushed;
}
