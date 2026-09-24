import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDocTable } from "./tier1-doc-table.ts";
import type { SourceMeta } from "./types.ts";

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

  it("pins EVERY non-blank fixture line byte-identical to its source line in samples/doc1.txt", () => {
    const sample = readFileSync(new URL("../../../samples/doc1.txt", import.meta.url), "utf8")
      .replace(/^\uFEFF/, "");
    const fixtureText = raw.replace(/^\uFEFF/, "");
    // The fixture is a splice of two sample ranges — lines 1–21 (table head)
    // and 255–259 (numbered prose tail) — joined by one artificial blank
    // separator line (fixture line 22), which is the only line not pinned here.
    const SPLICES: Array<[from: number, to: number]> = [
      [1, 21],
      [255, 259],
    ]; // 1-based, inclusive sample line ranges
    const sampleLines = sample.split(/\r?\n/);
    const expectedLines = SPLICES.flatMap(([from, to]) => sampleLines.slice(from - 1, to)).filter(
      (l) => l.trim(),
    );
    const fixtureLines = fixtureText.split(/\r?\n/).filter((l) => l.trim());
    expect(fixtureLines).toEqual(expectedLines);
  });
});

describe("parseDocTable (layout 1 back-compat: single-line tab-separated rows)", () => {
  it("parses a 3-column tabbed row as front/reading/back with confidence 0.9", () => {
    const result = parseDocTable("ส่ง\tsòng\tsend", META);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      front: "ส่ง",
      reading: "sòng",
      back: "send",
      confidence: 0.9,
    });
    expect(result.unparsed).toHaveLength(0);
  });

  it("parses a 2-column tabbed row as front/back (no reading)", () => {
    const result = parseDocTable("เรียน\tlearn", META);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ front: "เรียน", back: "learn", confidence: 0.9 });
    expect(result.cards[0]!.reading).toBeUndefined();
  });
});

describe("parseDocTable (digit-front guard: failed group ends table, rest → unparsed)", () => {
  it("stops the table at a numbered prose section with NO blank-line separator", () => {
    const doc = [
      "Thai",
      "\tPronunciation",
      "\tMeaning",
      "\tส่ง",
      "\tsòng",
      "\tsend",
      "\t1. รับผิดชอบ",
      "Examples:",
      "เขาไม่ยอมรับผิดชอบ",
    ].join("\r\n");
    const result = parseDocTable(doc, META);

    // The real row before the numbered section still becomes a card.
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ front: "ส่ง", reading: "sòng", back: "send" });

    // The digit-fronted group must NOT become a card (digit-front guard).
    expect(result.cards.some((c) => c.front.includes("รับผิดชอบ"))).toBe(false);

    // Failed group → early return: the numbered section and everything after
    // it lands in unparsed for Tier 2.
    const joined = result.unparsed.join("\n");
    expect(joined).toContain("1. รับผิดชอบ");
    expect(joined).toContain("Examples:");
    expect(joined).toContain("เขาไม่ยอมรับผิดชอบ");
  });
});
