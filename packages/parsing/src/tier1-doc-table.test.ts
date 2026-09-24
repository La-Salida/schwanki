import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDocTable } from "./tier1-doc-table";
import type { SourceMeta } from "./types";

const META: SourceMeta = { type: "google_doc", language: "th" };

describe("parseDocTable (golden fixture, real Drive cell-per-line export)", () => {
  const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("../test/fixtures/th-doc-table.expected.json", import.meta.url), "utf8"),
  );
  const result = parseDocTable(raw, META);

  it("parses cell-per-line rows as front/reading/back", () => {
    expect(result.cards).toHaveLength(expected.cards.length);
    for (const [i, exp] of expected.cards.entries()) {
      expect(result.cards[i]!.front).toBe(exp.front);
      expect(result.cards[i]!.back).toBe(exp.back);
      expect(result.cards[i]!.reading).toBe(exp.reading);
    }
  });

  it("skips the header cells", () => {
    expect(result.cards.some((c) => c.front === "Thai")).toBe(false);
    expect(result.cards.some((c) => c.front === "Pronunciation")).toBe(false);
  });

  it("passes the teacher's multi-word front through verbatim (no correction)", () => {
    expect(result.cards.some((c) => c.front === "จ่าย จ่ายเงิน")).toBe(true);
  });

  it("NEVER fixes the teacher's typo (arrrive survives verbatim, cell-stream mode)", () => {
    const typoDoc = "Thai\r\n\tPronunciation\r\n\tMeaning\r\n\tถึง\r\n\tthʉ̌ng\r\n\tarrrive\r\n";
    const typoResult = parseDocTable(typoDoc, META);
    expect(typoResult.cards.find((c) => c.front === "ถึง")!.back).toBe("arrrive");
  });

  it("forwards the non-tabular Examples section to Tier 2 via unparsed", () => {
    const joined = result.unparsed.join("\n");
    expect(joined).toContain("รับผิดชอบ");
    expect(joined).toContain("→ He refuses to take responsibility.");
  });

  it("fixture is byte-true to samples/doc1.txt (first 21 non-blank lines)", () => {
    const sample = readFileSync(new URL("../../../samples/doc1.txt", import.meta.url), "utf8")
      .replace(/^\uFEFF/, "");
    const fixtureText = raw.replace(/^\uFEFF/, "");
    const sampleLines = sample.split(/\r?\n/).filter((l) => l.trim());
    const fixtureLines = fixtureText.split(/\r?\n/).filter((l) => l.trim());
    expect(fixtureLines.slice(0, 21)).toEqual(sampleLines.slice(0, 21));
  });
});
