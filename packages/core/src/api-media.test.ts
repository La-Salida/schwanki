import { describe, it, expect } from "vitest";
import { mapCardMedia } from "./api.ts";

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
