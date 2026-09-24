import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "./orchestrator";
import type { LlmProvider, SourceMeta } from "./types";

describe("parse orchestrator", () => {
  it("routes sheets to tier-1 without touching the LLM", async () => {
    const raw = readFileSync(new URL("../test/fixtures/zh-sheet.csv", import.meta.url), "utf8");
    let llmCalled = false;
    const spy: LlmProvider = { parseCards: async () => { llmCalled = true; return { cards: [] }; } };
    const cards = await parse(raw, { type: "google_sheet", language: "zh" }, spy);
    expect(cards.length).toBeGreaterThan(0);
    expect(llmCalled).toBe(true); // 1 unparsed row ("confidence") escalates
    expect(cards.some((c) => c.front === "confidence")).toBe(false); // invalid front rejected
  });

  it("doc: tier-1 table + tier-2 sections merge into one list", async () => {
    const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
    const recorded = JSON.parse(readFileSync(new URL("../test/fixtures/th-doc-sections.llm-response.json", import.meta.url), "utf8"));
    const llm: LlmProvider = { parseCards: async () => recorded };
    const cards = await parse(raw, { type: "google_doc", language: "th" } satisfies SourceMeta, llm);
    expect(cards.some((c) => c.front === "ส่ง")).toBe(true);      // from tier 1
    expect(cards.some((c) => c.front === "รับผิดชอบ")).toBe(true); // from tier 2
  });

  it("without an llm provider, unparsed lines are dropped silently", async () => {
    const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
    const cards = await parse(raw, { type: "google_doc", language: "th" });
    expect(cards.some((c) => c.front === "ส่ง")).toBe(true);
    expect(cards.some((c) => c.front === "รับผิดชอบ")).toBe(false);
  });
});
