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
  it("prioritizes beginner language and a single unknown word over scene complexity", () => {
    const p = buildSentencePrompt({ ...CARD, front: "腹肌", back: "abs" }, "a cat on a beach with a mirror");
    expect(p).toContain("only potentially new word");
    expect(p).toContain("one simple clause");
    expect(p).toContain("No English glosses");
    expect(p).toContain("familiar words");
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
  it("rejects mixed-language and overcomplicated examples before generating paid media", () => {
    expect(() => parseSentenceResponse("SENTENCE: 我的腹肌很明显 obvious 了！\nTRANSLATION: My abs are obvious.", { language: "zh", front: "腹肌" })).toThrow("mixed languages");
    expect(() => parseSentenceResponse("SENTENCE: 一只橘猫躺在沙滩椅上，用两只前爪举着一面小镜子，认真地欣赏自己晒出的六块腹肌。\nTRANSLATION: A cat admires its abs.", { language: "zh", front: "腹肌" })).toThrow("too complex");
    expect(parseSentenceResponse("SENTENCE: 猫有腹肌。\nTRANSLATION: The cat has abs.", { language: "zh", front: "腹肌" }).sentence).toBe("猫有腹肌。");
  });
  it("bounds Thai examples by graphemes even when they have no spaces", () => {
    const card = { language: "th", front: "แมว" };
    expect(parseSentenceResponse("SENTENCE: ฉันมีแมว\nTRANSLATION: I have a cat.", card).sentence).toBe("ฉันมีแมว");
    expect(() => parseSentenceResponse(`SENTENCE: ${"ฉันมีแมว".repeat(20)}\nTRANSLATION: A long example.`, card)).toThrow("too complex");
  });
});

describe("buildImagePrompt", () => {
  it("describes the scene, never renders text", () => {
    const p = buildImagePrompt("外婆的厨房值得投资。", "Grandma's kitchen is worth investing in.");
    expect(p).toContain("Grandma's kitchen is worth investing in.");
    expect(p.toLowerCase()).toContain("no text");
  });
  it("makes the vocabulary meaning the visual focal point", () => {
    const p = buildImagePrompt("猫有腹肌。", "The cat has abs.", { front: "腹肌", back: "abdominal muscles / abs" });
    expect(p).toContain('meaning "abdominal muscles / abs"');
    expect(p).toContain("centrally visible");
    expect(p).toContain("never hide it");
    expect(p).toContain("must be the focal point");
    expect(p).not.toContain("腹肌");
    expect(p).toContain("no labels");
  });
  it("does not mistake ABS brakes or abs() for abdominal muscles", () => {
    for (const card of [
      { ...CARD, front: "ABS", back: "anti-lock braking system" },
      { ...CARD, front: "abs()", back: "absolute value" },
    ]) {
      expect(buildSentencePrompt(card)).not.toMatch(/腹肌|six-pack|abdominal/);
      const image = buildImagePrompt("", "Show the stated meaning.", card);
      expect(image).not.toMatch(/six-pack|abdominal/);
      expect(image).toContain(card.back);
    }
  });
});
