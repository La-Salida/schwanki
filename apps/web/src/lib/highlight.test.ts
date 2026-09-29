import { describe, it, expect } from "vitest";
import { wordRange, frontTerms, frontRanges } from "./highlight";

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

describe("frontTerms / frontRanges (structure cards)", () => {
  const slices = (sentence: string, front: string) =>
    frontRanges(sentence, front).map(([s, e]) => sentence.slice(s, e));

  it("plain word front highlights the word", () => {
    expect(slices("外婆的厨房值得投资。", "投资")).toEqual(["投资"]);
  });
  it("contrast pair front (计划vs打算) highlights both words where used", () => {
    expect(slices("我的猫制订了一份偷冰箱的周密计划，却只打算在凌晨三点踩一下我的脸。", "计划vs打算"))
      .toEqual(["计划", "打算"]);
  });
  it("structure pattern front (A没有B这么adj.) highlights the fixed parts, skipping placeholders", () => {
    expect(slices("我家乌龟没有隔壁乌龟这么帅，可它天天戴墨镜在鱼缸里游泳。", "A没有B这么adj."))
      .toEqual(["没有", "这么"]);
  });
  it("returns no ranges when nothing from the front appears", () => {
    expect(frontRanges("毫无关系的句子。", "A没有B这么adj.")).toEqual([]);
    expect(frontTerms("A B C")).toEqual([]);
  });
});
