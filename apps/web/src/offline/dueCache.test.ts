import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { cacheDueCards, loadCachedDueCards } from "./dueCache";
import { closeDb } from "./db";
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
});
