import { describe, it, expect } from "vitest";
import type { SchwankiCard } from "@schwanki/core";
import { buildSentencePrompt, parseSentenceResponse, buildImagePrompt } from "./prompt.ts";

const CARD: SchwankiCard = {
  id: "c1", userId: "u1", sourceId: null, language: "zh",
  front: "投资", back: "invest", reading: "tóu zī", createdAt: "2026-09-28T00:00:00Z",
};

describe("buildSentencePrompt", () => {
  it("quotes the hook verbatim as user content", () => {
    const p = buildSentencePrompt(CARD, "my grandma's kitchen");
    expect(p).toContain('"""my grandma\'s kitchen"""');
    expect(p).toContain('"""投资"""');
    expect(p).toContain('"""tóu zī"""');
    expect(p).toContain("SENTENCE:");
    expect(p).toContain("TRANSLATION:");
  });
  it("uses surprise-me mode without a hook", () => {
    expect(buildSentencePrompt(CARD)).toContain("surprise-me");
  });
});

describe("parseSentenceResponse", () => {
  it("parses the exact format", () => {
    expect(parseSentenceResponse("SENTENCE: 外婆的厨房值得投资。\nTRANSLATION: Grandma's kitchen is worth investing in."))
      .toEqual({ sentence: "外婆的厨房值得投资。", translation: "Grandma's kitchen is worth investing in." });
  });
  it("throws on malformed output", () => {
    expect(() => parseSentenceResponse("no format here")).toThrow("malformed");
  });
  it("strips inline <think> reasoning before parsing", () => {
    expect(parseSentenceResponse(
      "<think>The user wants a scene about grandma's kitchen… I should use 投资.</think>\nSENTENCE: 外婆的厨房值得投资。\nTRANSLATION: Grandma's kitchen is worth investing in.",
    )).toEqual({ sentence: "外婆的厨房值得投资。", translation: "Grandma's kitchen is worth investing in." });
  });
  it("throws a legible error on empty content (reasoning models can exhaust the token budget)", () => {
    expect(() => parseSentenceResponse(null as unknown as string)).toThrow("empty content");
    expect(() => parseSentenceResponse("")).toThrow("empty content");
  });
});

describe("buildImagePrompt", () => {
  it("describes the scene, never renders text", () => {
    const p = buildImagePrompt("外婆的厨房值得投资。", "Grandma's kitchen is worth investing in.");
    expect(p).toContain("Grandma's kitchen is worth investing in.");
    expect(p.toLowerCase()).toContain("no text");
  });
});
