import { describe, it, expect } from "vitest";
import { wordRange } from "./highlight";

const covered = (sentence: string, word: string) => {
  const r = wordRange(sentence, word);
  return r ? sentence.slice(r[0], r[1]) : null;
};

describe("wordRange", () => {
  it("finds the word verbatim in a CJK sentence (no over-extension)", () => {
    expect(covered("外婆的厨房值得投资。", "投资")).toBe("投资");
  });
  it("extends a latin partial match to the full inflected token", () => {
    expect(covered("Grandma's kitchen is worth INVESTING in.", "invest")).toBe("INVESTING");
  });
  it("matches case-insensitively and extends", () => {
    expect(covered("Ich liebe Katzen.", "katze")).toBe("Katzen");
  });
  it("falls back to stem matching for inflected words", () => {
    expect(covered("She invested all her savings.", "investing")).toBe("invested");
  });
  it("returns null when the word is not in the sentence", () => {
    expect(wordRange("A completely different sentence.", "投资")).toBeNull();
    expect(wordRange("Anything.", "   ")).toBeNull();
  });
});
