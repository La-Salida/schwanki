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
});

describe("buildImagePrompt", () => {
  it("describes the scene, never renders text", () => {
    const p = buildImagePrompt("外婆的厨房值得投资。", "Grandma's kitchen is worth investing in.");
    expect(p).toContain("Grandma's kitchen is worth investing in.");
    expect(p.toLowerCase()).toContain("no text");
  });
});
