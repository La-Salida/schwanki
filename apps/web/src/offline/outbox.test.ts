import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { queueReview, flushOutbox } from "./outbox";
import { closeDb, db } from "./db";
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

  it("joins an active flush before checking for newly queued reviews", async () => {
    await queueReview(ITEM);
    let calls = 0;
    let resolveSave!: () => void;
    const gate = new Promise<void>((res) => { resolveSave = res; });
    const fakeApi = { saveReview: async () => { calls++; await gate; } };
    const first = flushOutbox(fakeApi as never);
    let joined = false;
    const second = flushOutbox(fakeApi as never).then((n) => { joined = true; return n; });
    await Promise.resolve();
    expect(joined).toBe(false);
    resolveSave();
    expect(await first).toBe(1);
    expect(await second).toBe(0);
    expect(calls).toBe(1);
  });

  it.each(["new", "legacy"])("retries an interrupted %s save with the same event ID", async (kind) => {
    if (kind === "legacy") await (await db()).add("outbox", ITEM);
    else await queueReview(ITEM);
    const ids: Array<string | undefined> = [];
    await flushOutbox({ saveReview: async (_state, event) => { ids.push(event.id); throw new Error("response lost"); } });
    await closeDb();
    await flushOutbox({ saveReview: async (_state, event) => { ids.push(event.id); } });
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[1]).toBe(ids[0]);
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

  it("discards a review for a remotely deleted card so later ratings can sync", async () => {
    await queueReview(ITEM);
    await queueReview({ state: { ...ITEM.state, cardId: "c2" }, event: { ...ITEM.event, cardId: "c2" } });
    const saved: string[] = [];
    expect(await flushOutbox({ saveReview: async (state) => {
      if (state.cardId === "c1") throw { code: "23503", message: 'violates foreign key constraint "card_state_card_id_fkey"' };
      saved.push(state.cardId);
    } })).toBe(1);
    expect(saved).toEqual(["c2"]);
    expect(await flushOutbox({ saveReview: async () => {} })).toBe(0);
  });

  it("serializes independent tab contexts with the same browser lock", async () => {
    let tail: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_name: string, work: () => Promise<number>) => {
      const next = tail.then(work);
      tail = next.catch(() => {});
      return next;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    vi.resetModules();
    const first = await import("./outbox");
    const firstDb = await import("./db");
    vi.resetModules();
    const second = await import("./outbox");
    const secondDb = await import("./db");
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const saved: number[] = [];
    try {
      await first.queueReview(ITEM);
      await first.queueReview({ state: { ...ITEM.state, reps: 2 }, event: { ...ITEM.event, reviewedAt: "2026-09-24T10:01:00Z" } });
      const api = { saveReview: async (state: QueuedReview["state"]) => { saved.push(state.reps); if (saved.length === 1) await gate; } };
      const a = first.flushOutbox(api);
      await vi.waitFor(() => expect(saved).toEqual([1]));
      const b = second.flushOutbox(api);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(saved).toEqual([1]);
      release();
      await Promise.all([a, b]);
      expect(saved).toEqual([1, 2]);
      expect(request.mock.calls.map(call => call[0])).toEqual(["schwanki-review-outbox", "schwanki-review-outbox"]);
    } finally {
      release();
      await firstDb.closeDb(); await secondDb.closeDb();
      vi.unstubAllGlobals(); vi.resetModules();
    }
  });
});
