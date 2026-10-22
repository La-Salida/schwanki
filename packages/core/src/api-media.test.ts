import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapCardMedia, SchwankiApi } from "./api.ts";

describe("mapCardMedia", () => {
  it("maps snake_case rows and drops nulls to undefined", () => {
    const m = mapCardMedia({
      id: "m1", card_id: "c1", generation_id: "g1", kind: "sentence",
      content: "这是一句话。", storage_path: null, prompt_used: "grandma",
      provider: "anthropic", created_at: "2026-09-28T00:00:00Z",
    });
    expect(m).toEqual({
      id: "m1", cardId: "c1", generationId: "g1", kind: "sentence",
      content: "这是一句话。", storagePath: undefined, promptUsed: "grandma",
      provider: "anthropic", createdAt: "2026-09-28T00:00:00Z",
    });
  });
});

function mediaApi() {
  const pending = ["u1/old.png"];
  const remove = vi.fn().mockResolvedValue({ error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const finish = vi.fn(async (_column: string, paths: string[]) => {
    for (const path of paths) pending.splice(pending.indexOf(path), 1);
    return { error: null };
  });
  const ownership = { eq: vi.fn(), single: vi.fn().mockResolvedValue({ error: null }) };
  ownership.eq.mockReturnValue(ownership);
  const from = vi.fn((table: string) => table === "card_media_cleanup" ? {
    select: () => ({ limit: async () => ({ data: pending.map(storage_path => ({ storage_path })), error: null }) }),
    delete: () => ({ in: finish }),
    insert: async (row: { storage_path: string }) => { pending.push(row.storage_path); return { error: null }; },
  } : table === "cards" ? { select: () => ownership } : {
    delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }), upsert,
  });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const db = { from, rpc, storage: { from: () => ({ remove, upload }) }, auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } } as unknown as SupabaseClient;
  return { api: new SchwankiApi(db), pending, remove, upload, upsert, finish, rpc };
}

describe("stored media cleanup", () => {
  it("deletes the stored objects when removing media or invalidating a sentence", async () => {
    for (const action of ["remove", "sentence"] as const) {
      const { api, remove, pending, finish } = mediaApi();
      if (action === "remove") await api.removeCardMedia("c1", "image");
      else await api.saveCardExample("c1", "new", "translation");
      expect(remove).toHaveBeenCalledWith(["u1/old.png"]);
      expect(finish.mock.invocationCallOrder[0]).toBeGreaterThan(remove.mock.invocationCallOrder[0]!);
      expect(pending).toEqual([]);
    }
  });
  it("retains failed deletions for retry instead of claiming removal succeeded", async () => {
    const { api, remove, pending, finish } = mediaApi();
    remove.mockResolvedValueOnce({ error: new Error("storage offline") });
    await expect(api.removeCardMedia("c1", "image")).rejects.toThrow("storage offline");
    expect(pending).toEqual(["u1/old.png"]);
    expect(finish).not.toHaveBeenCalled();
    await api.cleanupCardMedia();
    expect(pending).toEqual([]);
  });
  it("keeps a replacement while deleting the previous file", async () => {
    const { api, remove, upsert } = mediaApi();
    await api.replaceCardFile("c1", "image", { name: "cat.png", body: new Blob(["pixels"]), contentType: "image/png" });
    const replacement = upsert.mock.calls[0]![0].storage_path;
    expect(replacement).toMatch(/^u1\/manual\/c1\/.*\.png$/);
    expect(remove).toHaveBeenCalledWith(["u1/old.png"]);
  });
  it("cleans up an upload that could not be attached to the card", async () => {
    const { api, remove, upsert, pending } = mediaApi();
    upsert.mockResolvedValueOnce({ error: new Error("row failed") });
    await expect(api.replaceCardFile("c1", "image", { name: "cat.png", body: new Blob(["pixels"]), contentType: "image/png" })).rejects.toThrow("row failed");
    expect(remove.mock.calls[0]![0]).toContain(upsert.mock.calls[0]![0].storage_path);
    expect(pending).toEqual([]);
  });
});
