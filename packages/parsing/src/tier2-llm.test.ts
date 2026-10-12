import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseWithLlm, PDF_CHUNK_LINES } from "./tier2-llm.ts";
import { ParseTruncatedError } from "./openai-compatible.ts";
import type { LlmProvider, SourceMeta } from "./types.ts";

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

describe("PDF chunking", () => {
  const meta: SourceMeta = { type: "pdf_upload", language: "zh" };
  const notes = Array.from({ length: 45 }, (_, i) => `词${i} word ${i}`).join("\n");
  const linesIn = (prompt: string) => prompt.split('"""')[1]!.trim().split("\n").length;

  it("sends long lesson notes in pieces of at most PDF_CHUNK_LINES lines", async () => {
    let calls = 0;
    const llm = { parseCards: vi.fn(async (prompt: string) => {
      expect(linesIn(prompt)).toBeLessThanOrEqual(PDF_CHUNK_LINES);
      return { cards: [{ front: `词${++calls}`, back: "w" }] };
    }) };
    const cards = await parseWithLlm(notes, meta, llm);
    expect(llm.parseCards).toHaveBeenCalledTimes(Math.ceil(45 / PDF_CHUNK_LINES));
    expect(cards).toHaveLength(3);
    expect(cards[0]!.rawContext.split("\n").length).toBeLessThanOrEqual(PDF_CHUNK_LINES);
  });

  it("halves a piece and retries when the model's answer is truncated", async () => {
    let calls = 0;
    const llm = { parseCards: vi.fn(async (prompt: string) => {
      if (linesIn(prompt) > 10) throw new ParseTruncatedError();
      return { cards: [{ front: `词${++calls}`, back: "w" }] };
    }) };
    const cards = await parseWithLlm(notes, meta, llm);
    expect(cards.length).toBeGreaterThan(3);
  });

  it("still fails the PDF job when even small pieces are truncated", async () => {
    const llm = { parseCards: vi.fn(async () => { throw new ParseTruncatedError(); }) };
    await expect(parseWithLlm(notes, meta, llm)).rejects.toThrow(/truncated/);
  });
});
