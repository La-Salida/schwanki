import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseDocTable } from "./tier1-doc-table";
import type { SourceMeta } from "./types";

const META: SourceMeta = { type: "google_doc", language: "th" };

describe("parseDocTable (golden fixture)", () => {
  const raw = readFileSync(new URL("../test/fixtures/th-doc-table.txt", import.meta.url), "utf8");
  const expected = JSON.parse(
    readFileSync(new URL("../test/fixtures/th-doc-table.expected.json", import.meta.url), "utf8"),
  );
  const result = parseDocTable(raw, META);

  it("parses tab-separated rows as front/reading/back", () => {
    expect(result.cards).toHaveLength(expected.cards.length);
    for (const [i, exp] of expected.cards.entries()) {
      expect(result.cards[i]!.front).toBe(exp.front);
      expect(result.cards[i]!.back).toBe(exp.back);
      expect(result.cards[i]!.reading).toBe(exp.reading);
    }
  });

  it("skips the header row", () => {
    expect(result.cards.some((c) => c.front === "Thai")).toBe(false);
  });

  it("NEVER fixes the teacher's typo (arrrive survives verbatim)", () => {
    expect(result.cards.find((c) => c.front === "ถึง")!.back).toBe("arrrive");
  });

  it("forwards the non-tabular Examples section to Tier 2 via unparsed", () => {
    const joined = result.unparsed.join("\n");
    expect(joined).toContain("รับผิดชอบ");
    expect(joined).toContain("→ He refuses to take responsibility.");
  });
});
