import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { cacheDueCards, loadCachedDueCards, removeCachedDeck } from "./dueCache";
import { closeDb, db } from "./db";
import { queueReview, flushOutbox } from "./outbox";
import type { CardState, DueCard, SchwankiCard } from "@schwanki/core";

const CARD: SchwankiCard = {
  id: "c1",
  userId: "u1",
  sourceId: null,
  language: "zh",
  front: "你好",
  back: "hello",
  createdAt: "2026-09-01T00:00:00Z",
};

const STATE: CardState = {
  cardId: "c1",
  dueAt: "2026-09-25T10:00:00Z",
  stability: 1,
  difficulty: 5,
  reps: 1,
  lapses: 0,
  fsrs: {},
};

const DUE: DueCard = { card: CARD, state: STATE };

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("schwanki-offline");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe("due-card cache", () => {
  beforeEach(async () => { await closeDb(); await deleteDb(); });

  it("caches due cards and loads them back", async () => {
    await cacheDueCards([DUE, { card: { ...CARD, id: "c2" }, state: null }]);
    const loaded = await loadCachedDueCards();
    expect(loaded.map((d) => d.card.id).sort()).toEqual(["c1", "c2"]);
    expect(loaded.find((d) => d.card.id === "c1")?.state).toEqual(STATE);
  });

  it("replaces the previous cache on re-cache", async () => {
    await cacheDueCards([DUE]);
    await cacheDueCards([{ card: { ...CARD, id: "c3" }, state: null }]);
    const loaded = await loadCachedDueCards();
    expect(loaded.map((d) => d.card.id)).toEqual(["c3"]);
  });

  it("keeps a queued rating after reload and excludes it until its next due date", async () => {
    await cacheDueCards([DUE]);
    const state = { ...STATE, dueAt: "2100-01-01T00:00:00Z", reps: 2 };
    await queueReview({ state, event: { cardId: CARD.id, rating: "good", reviewedAt: "2026-10-21T00:00:00Z", fsrsStateBefore: {} } });
    await closeDb();
    expect(await loadCachedDueCards(new Date("2026-10-22"))).toEqual([]);
    expect((await loadCachedDueCards(new Date("2100-01-02")))[0]?.state).toEqual(state);
  });

  it("does not overwrite a pending local rating with stale server data", async () => {
    await cacheDueCards([DUE]);
    const state = { ...STATE, dueAt: "2100-01-01T00:00:00Z", reps: 2 };
    await queueReview({ state, event: { cardId: CARD.id, rating: "good", reviewedAt: "2026-10-21T00:00:00Z", fsrsStateBefore: {} } });
    await cacheDueCards([DUE]);
    expect((await loadCachedDueCards(new Date("2100-01-02")))[0]?.state).toEqual(state);
    await cacheDueCards([]); // server may have saved state before a later request failed
    expect((await loadCachedDueCards(new Date("2100-01-02")))[0]?.state).toEqual(state);
  });

  it("keeps the newer local schedule if an older fetch finishes after a successful flush", async () => {
    await cacheDueCards([DUE]);
    const state = { ...STATE, dueAt: "2100-01-01T00:00:00Z", reps: 2, lastReviewedAt: "2026-10-21T00:00:00Z" };
    await queueReview({ state, event: { cardId: CARD.id, rating: "good", reviewedAt: state.lastReviewedAt, fsrsStateBefore: {} } });
    await flushOutbox({ saveReview: async () => {} });
    await cacheDueCards([DUE]);
    expect((await loadCachedDueCards(new Date("2100-01-02")))[0]?.state).toEqual(state);
    await cacheDueCards([]); // server omits reviewed cards until they're due again
    expect((await loadCachedDueCards(new Date("2100-01-02")))[0]?.state).toEqual(state);
  });

  it("removes a deleted deck's cached cards and pending reviews without touching other decks", async () => {
    await cacheDueCards([DUE, { card: { ...CARD, id: "c2", sourceId: "other" }, state: null }]);
    await queueReview({ state: STATE, event: { cardId: CARD.id, rating: "good", reviewedAt: "2026-10-21T00:00:00Z", fsrsStateBefore: {} } });
    await removeCachedDeck([null], CARD.language);
    expect((await loadCachedDueCards()).map(c => c.card.id)).toEqual(["c2"]);
    expect(await (await db()).count("outbox")).toBe(0);
  });
});
