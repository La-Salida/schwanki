import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { queueReview, flushOutbox } from "./outbox";
import { closeDb } from "./db";
import type { QueuedReview } from "./types";

const ITEM: QueuedReview = {
  state: { cardId: "c1", dueAt: "2026-09-25T10:00:00Z", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: {} },
  event: { cardId: "c1", rating: "good", reviewedAt: "2026-09-24T10:00:00Z", fsrsStateBefore: {} },
};

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("schwanki-offline");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // fake-indexeddb: open connections don't block semantics we rely on
  });
}

describe("review outbox", () => {
  beforeEach(async () => { await closeDb(); await deleteDb(); });

  it("queues offline reviews and flushes them in order", async () => {
    await queueReview(ITEM);
    await queueReview({ ...ITEM, state: { ...ITEM.state, cardId: "c2" }, event: { ...ITEM.event, cardId: "c2" } });
    const saved: string[] = [];
    const fakeApi = { saveReview: async (s: { cardId: string }) => { saved.push(s.cardId); } };
    const flushed = await flushOutbox(fakeApi as never);
    expect(flushed).toBe(2);
    expect(saved).toEqual(["c1", "c2"]);
  });

  it("stops flushing on first failure (keeps remaining queued)", async () => {
    await queueReview(ITEM);
    await queueReview({ ...ITEM, state: { ...ITEM.state, cardId: "c2" }, event: { ...ITEM.event, cardId: "c2" } });
    let calls = 0;
    const fakeApi = { saveReview: async () => { calls++; if (calls === 1) throw new Error("offline"); } };
    const flushed = await flushOutbox(fakeApi as never);
    expect(flushed).toBe(0);
    // both still queued: a working api flushes 2
    const okApi = { saveReview: async () => {} };
    expect(await flushOutbox(okApi as never)).toBe(2);
  });
});
