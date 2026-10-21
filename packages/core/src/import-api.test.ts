import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SchwankiApi } from "./api.ts";
import { newCardState } from "./fsrs.ts";

type Result = { data?: unknown; error?: { message: string; code?: string } | null };
type Call = { table: string; method: string; args: unknown[] };

/** Fake client: each table answers with the next queued result; every builder call is recorded. */
function fakeDb(results: Record<string, Result[]>) {
  const calls: Call[] = [];
  const next = (table: string): Result => results[table]?.shift() ?? { data: [], error: null };
  const builder = (table: string) => {
    const self: Record<string, unknown> = {};
    for (const m of ["select", "insert", "upsert", "eq", "is", "lte", "order", "limit", "range"]) {
      self[m] = (...args: unknown[]) => { calls.push({ table, method: m, args }); return self; };
    }
    self.single = () => Promise.resolve(next(table));
    self.then = (resolve: (r: Result) => void) => resolve(next(table));
    return self;
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => { calls.push({ table: name, method: "rpc", args: [args] }); return next(name); },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const state = newCardState(new Date("2026-10-19T00:00:00Z"));
const card = (front: string) => ({ front, back: `${front} meaning`, state });

describe("importCards", () => {
  it("skips words already in the deck or repeated in the file, and saves each card's schedule", async () => {
    const { client, calls } = fakeDb({
      cards: [
        { data: [{ front: "猫" }], error: null }, // existing words
        { data: [{ id: "c2", front: "鳥" }, { id: "c1", front: "犬" }], error: null },
      ],
    });
    const progress: number[] = [];
    const ids = await new SchwankiApi(client).importCards("s1", "ja", [card("犬"), card(" 猫 "), card("鳥"), card("犬")], (n) => progress.push(n));
    expect(ids).toEqual(["c1", null, "c2", null]);
    const inserted = calls.find((c) => c.table === "cards" && c.method === "insert")!.args[0] as Array<{ front: string; source_id: string }>;
    expect(inserted.map((r) => r.front)).toEqual(["犬", "鳥"]);
    expect(inserted[0]!.source_id).toBe("s1");
    const states = calls.find((c) => c.table === "card_state" && c.method === "insert")!.args[0] as Array<{ card_id: string; due_at: string }>;
    expect(states.map((s) => s.card_id)).toEqual(["c1", "c2"]);
    expect(states[0]!.due_at).toBe("2026-10-19T00:00:00.000Z");
    expect(progress.at(-1)).toBe(4);
  });

  it("falls back to one at a time when the database finds a duplicate the check missed", async () => {
    const { client } = fakeDb({
      cards: [
        { data: [], error: null },
        { data: null, error: { message: "dup", code: "23505" } },
        { data: null, error: { message: "dup", code: "23505" } },
        { data: { id: "c9" }, error: null },
      ],
    });
    const ids = await new SchwankiApi(client).importCards("s1", "de", [card("Straße"), card("Haus")]);
    expect(ids).toEqual([null, "c9"]);
  });
});

describe("listDueCards", () => {
  it("asks for due states with their cards, most overdue first", async () => {
    const { client, calls } = fakeDb({
      card_state: [{ data: [{ card_id: "c1", due_at: "2026-10-01T00:00:00Z", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: {}, cards: { id: "c1", user_id: "u1", source_id: null, language: "ja", front: "犬", back: "dog", created_at: "x" } }], error: null }],
    });
    const due = await new SchwankiApi(client).listDueCards(new Date("2026-10-19T00:00:00Z"));
    expect(due[0]!.card.front).toBe("犬");
    expect(due[0]!.state!.dueAt).toBe("2026-10-01T00:00:00Z");
    expect(calls).toContainEqual({ table: "card_state", method: "lte", args: ["due_at", "2026-10-19T00:00:00.000Z"] });
    expect(calls).toContainEqual({ table: "card_state", method: "order", args: ["due_at"] });
  });

  it("also returns cards that never got a state row, as new", async () => {
    const { client, calls } = fakeDb({
      card_state: [{ data: [], error: null }],
      cards: [{ data: [{ id: "c2", user_id: "u1", source_id: null, language: "ja", front: "猫", back: "cat", created_at: "x", card_state: null }], error: null }],
    });
    const due = await new SchwankiApi(client).listDueCards(new Date("2026-10-19T00:00:00Z"));
    expect(due).toEqual([expect.objectContaining({ state: null, card: expect.objectContaining({ id: "c2" }) })]);
    expect(calls).toContainEqual({ table: "cards", method: "is", args: ["card_state", null] });
  });

  it("still lists due cards when the stateless lookup fails", async () => {
    const { client } = fakeDb({
      card_state: [{ data: [], error: null }],
      cards: [{ data: null, error: { message: "bad filter" } }],
    });
    expect(await new SchwankiApi(client).listDueCards(new Date())).toEqual([]);
  });
});


describe("saveReview", () => {
  it("uses the durable event ID as an idempotency key on retries", async () => {
    const { client, calls } = fakeDb({});
    const api = new SchwankiApi(client);
    const event = { id: "10000000-0000-0000-0000-000000000001", cardId: "c1", rating: "good" as const, reviewedAt: "2026-10-21T00:00:00Z", fsrsStateBefore: {} };
    const saved = { cardId: "c1", dueAt: "2026-10-22T00:00:00Z", stability: 1, difficulty: 5, reps: 1, lapses: 0, fsrs: {} };
    await api.saveReview(saved, event);
    await api.saveReview(saved, event);
    const events = calls.filter(c => c.table === "save_review" && c.method === "rpc");
    expect(events).toHaveLength(2);
    for (const call of events) {
      expect(call.args[0]).toEqual({ p_state: saved, p_event: event });
    }
    expect(calls.some(c => c.table === "card_state" || c.table === "review_events")).toBe(false);
  });
});
