import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseSheet } from "./tier1-sheet";
import { dedupKey } from "@schwanki/core";
import type { SourceMeta } from "./types";

const META: SourceMeta = { type: "google_sheet", language: "zh" };

describe("parseSheet (golden fixture)", () => {
  const raw = readFileSync(new URL("../test/fixtures/zh-sheet.csv", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("../test/fixtures/zh-sheet.expected.json", import.meta.url), "utf8"),
  );
  const result = parseSheet(raw, META);

  it("parses every expected row with front/back/reading", () => {
    expect(result.cards).toHaveLength(expected.cards.length);
    for (const [i, exp] of expected.cards.entries()) {
      expect(result.cards[i]!.front).toBe(exp.front);
      expect(result.cards[i]!.back).toBe(exp.back);
      if (exp.reading) expect(result.cards[i]!.reading).toBe(exp.reading);
    }
  });

  it("never auto-corrects fused pinyin (恶ě心 passes through, flagged)", () => {
    const fused = result.cards.find((c) => c.front === "恶ě心");
    expect(fused).toBeDefined();
    expect(fused!.parseNotes).toMatch(/fused|suspicious/i);
  });

  it("drops #VALUE! rows entirely", () => {
    expect(result.cards.some((c) => c.rawContext.includes("#VALUE!"))).toBe(false);
  });

  it("dedups within batch", () => {
    const keys = result.cards.map((c) => dedupKey(c.front, "zh"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("escalates language-invalid rows to unparsed", () => {
    expect(result.unparsed).toHaveLength(expected.unparsedCount);
    expect(result.unparsed[0]).toContain("confidence");
  });

  it("preserves rawContext verbatim", () => {
    expect(result.cards[0]!.rawContext).toBe(",自信,confidence,zì xìn,");
  });

  it("assigns confidence: 0.95 full rows, 0.6 minimal rows", () => {
    expect(result.cards[0]!.confidence).toBe(0.95);
    const fused = result.cards.find((c) => c.front === "恶ě心")!;
    expect(fused.confidence).toBeLessThan(0.8);
  });
});
