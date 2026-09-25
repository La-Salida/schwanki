import { db } from "./db";
import type { QueuedReview } from "./types";

export async function queueReview(payload: QueuedReview): Promise<void> {
  await (await db()).add("outbox", payload);
}

interface ReviewSaver { saveReview: (state: QueuedReview["state"], event: QueuedReview["event"]) => Promise<void> }

let flushing = false;

/** Flush in FIFO order; stop at first failure so nothing is lost or reordered. Returns count flushed. */
export async function flushOutbox(api: ReviewSaver): Promise<number> {
  if (flushing) return 0; // re-entrancy guard: overlapping flushes would double-save the head item
  flushing = true;
  try {
    const d = await db();
    let flushed = 0;
    while (true) {
      // Read the head in a short readonly tx, close it, then await the network
      // OUTSIDE any transaction — otherwise the tx deactivates during the save
      // and the delete below would throw TransactionInactiveError.
      const readTx = d.transaction("outbox", "readonly");
      const cursor = await readTx.store.openCursor();
      await readTx.done;
      if (!cursor) break;
      const item = cursor.value as QueuedReview;
      const key = cursor.primaryKey;
      try {
        await api.saveReview(item.state, item.event);
      } catch {
        break; // keep the item queued; retry head-of-line next flush
      }
      await d.delete("outbox", key); // fresh short readwrite tx
      flushed++;
    }
    return flushed;
  } finally {
    flushing = false;
  }
}
