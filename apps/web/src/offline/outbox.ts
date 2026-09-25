import { db } from "./db";
import type { QueuedReview } from "./types";

export async function queueReview(payload: QueuedReview): Promise<void> {
  await (await db()).add("outbox", payload);
}

interface ReviewSaver { saveReview: (state: QueuedReview["state"], event: QueuedReview["event"]) => Promise<void> }

/** Flush in FIFO order; stop at first failure so nothing is lost or reordered. Returns count flushed. */
export async function flushOutbox(api: ReviewSaver): Promise<number> {
  const d = await db();
  let flushed = 0;
  while (true) {
    const tx = d.transaction("outbox", "readwrite");
    const cursor = await tx.store.openCursor();
    if (!cursor) { await tx.done; break; }
    const item = cursor.value as QueuedReview;
    try {
      await api.saveReview(item.state, item.event);
    } catch {
      await tx.done;
      break;
    }
    await cursor.delete();
    await tx.done;
    flushed++;
  }
  return flushed;
}
