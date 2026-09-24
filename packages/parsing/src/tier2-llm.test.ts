import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWithLlm } from "./tier2-llm";
import type { LlmProvider, SourceMeta } from "./types";

const META: SourceMeta = { type: "google_doc", language: "th" };
const chunk = readFileSync(new URL("../test/fixtures/th-doc-sections.txt", import.meta.url), "utf8");
const recorded = JSON.parse(
  readFileSync(new URL("../test/fixtures/th-doc-sections.llm-response.json", import.meta.url), "utf8"),
);

const mockLlm: LlmProvider = { parseCards: async () => recorded };

describe("parseWithLlm", () => {
  it("maps valid LLM JSON to CandidateCards with rawContext", async () => {
    const cards = await parseWithLlm(chunk, META, mockLlm);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.front).toBe("รับผิดชอบ");
    expect(cards[0]!.exampleSentence).toContain("He refuses");
    expect(cards[0]!.rawContext).toBe(chunk);
    expect(cards[0]!.confidence).toBeLessThanOrEqual(0.8);
  });

  it("drops malformed entries instead of failing the batch", async () => {
    const messy: LlmProvider = {
      parseCards: async () => ({ cards: [{ front: "x" }, { front: "รับผิดชอบ", back: "to take responsibility" }] }),
    };
    const cards = await parseWithLlm(chunk, META, messy);
    expect(cards).toHaveLength(1);
  });

  it("returns [] when provider throws (failure isolation, §6.3)", async () => {
    const broken: LlmProvider = { parseCards: async () => { throw new Error("api down"); } };
    await expect(parseWithLlm(chunk, META, broken)).resolves.toEqual([]);
  });
});
