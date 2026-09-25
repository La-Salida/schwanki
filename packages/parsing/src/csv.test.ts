import { describe, it, expect } from "vitest";
import { parseCsvLine } from "./csv.ts";

describe("parseCsvLine", () => {
  it("splits simple rows", () => {
    expect(parseCsvLine(",自信,confidence,zì xìn,")).toEqual(["", "自信", "confidence", "zì xìn", ""]);
  });
  it("handles quoted cells with commas", () => {
    expect(parseCsvLine(',"hello, world",x')).toEqual(["", "hello, world", "x"]);
  });
  it("handles escaped quotes", () => {
    expect(parseCsvLine('"she said ""hi""",x')).toEqual(['she said "hi"', "x"]);
  });
});
