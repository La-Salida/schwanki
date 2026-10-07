import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SchwankiApi } from "./api.ts";

function setup(error: { code?: string; message: string } | null = null) {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "c1" }, error }) };
  for (const name of ["update", "eq", "select"] as const) query[name].mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  const db = { from, auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } } as unknown as SupabaseClient;
  return { api: new SchwankiApi(db), from, query };
}
const edits = { front: " 明显 ", back: " obvious ", reading: "", exampleSentence: "" };
describe("manual card corrections", () => {
  it("updates only text, clears optional fields, and leaves review state and history alone", async () => {
    const { api, from, query } = setup();
    await api.updateCard("c1", edits);
    expect(from.mock.calls).toEqual([["cards"]]);
    expect(query.update).toHaveBeenCalledWith({ front: "明显", back: "obvious", reading: null, example_sentence: null });
    expect(query.eq.mock.calls).toEqual([["id", "c1"], ["user_id", "u1"]]);
  });
  it("edits a pending candidate without approving it", async () => {
    const { api, from, query } = setup();
    await api.updateCandidate("c1", edits);
    expect(from.mock.calls).toEqual([["candidate_cards"]]);
    expect(query.eq.mock.calls).toEqual([["id", "c1"], ["status", "pending"]]);
    expect(query.update.mock.calls[0]![0]).not.toHaveProperty("status");
  });
  it("keeps duplicate-word edits as errors instead of replacing another card", async () => {
    const { api } = setup({ code: "23505", message: "duplicate" });
    await expect(api.updateCard("c1", edits)).rejects.toThrow(/already has a card/);
  });
  it("refuses an empty meaning before issuing a write", async () => {
    const { api, query } = setup();
    await expect(api.updateCard("c1", { ...edits, back: " " })).rejects.toThrow(/required/);
    expect(query.update).not.toHaveBeenCalled();
  });
});
