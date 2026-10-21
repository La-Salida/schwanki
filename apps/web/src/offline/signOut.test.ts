import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
const saveReview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ api: { saveReview } }));
import { db, closeDb } from "./db";
import { prepareSignOut } from "./signOut";
import { queueReview } from "./outbox";
import type { QueuedReview } from "./types";
const review: QueuedReview = { state: { cardId: "c1", dueAt: "2026-10-20", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: {} }, event: { cardId: "c1", rating: "good", reviewedAt: "2026-10-20", fsrsStateBefore: {} } };
beforeEach(async () => { saveReview.mockReset(); const d = await db(); await d.clear("outbox"); await d.clear("due"); });
afterEach(closeDb);
it("saves queued reviews and clears cached cards before logout", async () => {
  saveReview.mockResolvedValue(undefined);
  await queueReview(review);
  await (await db()).put("due", { card: { id: "c1" } });
  await prepareSignOut();
  expect(saveReview).toHaveBeenCalledTimes(1);
  expect(await (await db()).count("outbox")).toBe(0);
  expect(await (await db()).count("due")).toBe(0);
});
it("preserves unsynced work when logout cannot safely finish", async () => {
  saveReview.mockRejectedValue(new Error("offline"));
  await queueReview(review);
  await expect(prepareSignOut()).rejects.toThrow("offline reviews haven't synced");
  expect(await (await db()).count("outbox")).toBe(1);
});
