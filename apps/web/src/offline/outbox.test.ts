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

  it("ignores a re-entrant flush while one is in progress", async () => {
    await queueReview(ITEM);
    let calls = 0;
    let resolveSave!: () => void;
    const gate = new Promise<void>((res) => { resolveSave = res; });
    const fakeApi = { saveReview: async () => { calls++; await gate; } };
    const first = flushOutbox(fakeApi as never);
    // second flush while the first is mid-save: must bail out immediately
    expect(await flushOutbox(fakeApi as never)).toBe(0);
    resolveSave();
    expect(await first).toBe(1);
    expect(calls).toBe(1);
  });

  it("retries head-of-line in order after a mid-queue failure", async () => {
    const mk = (id: string): QueuedReview => ({
      ...ITEM,
      state: { ...ITEM.state, cardId: id },
      event: { ...ITEM.event, cardId: id },
    });
    await queueReview(mk("c1"));
    await queueReview(mk("c2"));
    await queueReview(mk("c3"));
    const failingApi = { saveReview: async (s: { cardId: string }) => { if (s.cardId === "c1") throw new Error("offline"); } };
    expect(await flushOutbox(failingApi as never)).toBe(0);
    const saved: string[] = [];
    const okApi = { saveReview: async (s: { cardId: string }) => { saved.push(s.cardId); } };
    expect(await flushOutbox(okApi as never)).toBe(3);
    expect(saved).toEqual(["c1", "c2", "c3"]);
  });
});
