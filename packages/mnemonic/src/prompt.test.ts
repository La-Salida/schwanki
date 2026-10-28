import { describe, it, expect } from "vitest";
import type { SchwankiCard } from "@schwanki/core";
import { buildSentencePrompt, parseSentenceResponse, buildImagePrompt, buildScenePrompt, parseSceneResponse, fallbackScene, CHAOS_GOOSE, unnameGoose } from "./prompt.ts";

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
  it("keeps the goose out of the sentence, with or without a hook", () => {
    const surprise = buildSentencePrompt(CARD);
    expect(surprise).toContain("surprise-me");
    expect(surprise).toContain("natural, everyday sentence");
    expect(surprise).not.toContain("goose");
    expect(buildSentencePrompt(CARD, "my grandma's kitchen")).not.toContain("goose");
  });
  it("uses a card that is already a full phrase as the sentence", () => {
    expect(buildSentencePrompt({ ...CARD, language: "ja", front: "ちゅうもんおねがいします" }))
      .toContain("use it exactly as the sentence");
  });
  it("prioritizes beginner language and a single unknown word over scene complexity", () => {
    const p = buildSentencePrompt({ ...CARD, front: "腹肌", back: "abs" }, "a cat on a beach with a mirror");
    expect(p).toContain("only potentially new word");
    expect(p).toContain("one simple clause");
    expect(p).toContain("No English glosses");
    expect(p).toContain("familiar words");
    expect(p).toContain("Preserve its concrete subject");
    expect(p).toContain("Keep that subject explicit");
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
    expect(() => parseSentenceResponse("SENTENCE: ฉันมีแมว cat\nTRANSLATION: I have a cat.", card)).toThrow("mixed languages");
  });
});

describe("buildImagePrompt", () => {
  it("never carries a sentence, quote or non-Latin text for the image model to copy", () => {
    const p = buildImagePrompt('A man flexes a huge arm muscle over a plate of eggs, "build muscle (增加肌肉)"');
    expect(p).toContain("A man flexes a huge arm muscle over a plate of eggs");
    expect(p).not.toMatch(/["“”]|增|build muscle/);
    expect(p).toContain("every surface is blank and unmarked");
    expect(p.toLowerCase()).not.toMatch(/vocabulary|caption|label|letters/);
  });
  it("draws in the landing page's look: bold-outline cartoon on cream paper, a full scene", () => {
    const p = buildImagePrompt("a goose eats a sandwich on a park bench");
    expect(p).toContain("thick black outlines and flat vivid colors");
    expect(p).toContain("light cream paper");
    expect(p).toContain("A full scene with a setting");
    expect(p).not.toMatch(/storybook|painting|plain warm cream background/);
  });
});

describe("scene brief", () => {
  it("asks for a visual description with no wording and no writing-bearing objects", () => {
    const p = buildScenePrompt("They revoked that championship title.", "revoke a championship title");
    expect(p).toContain("Never quote or restate the example situation");
    expect(p).toContain("plaques");
    expect(p).toMatch(/SCENE: <description>$/);
  });
  it("describes the mascot the way the landing page draws it", () => {
    const p = buildScenePrompt("The goose ate my sandwich.", "to eat up");
    expect(p).toContain(`The main character is always Schwanki's goose, which looks exactly like this: ${CHAOS_GOOSE}`);
    expect(p).toContain("in place of the person");
    expect(CHAOS_GOOSE).toBe("a white goose in a black leather jacket with a small yellow smiley pin");
  });
  it("parses the scene line and strips quotes and non-Latin script", () => {
    expect(parseSceneResponse('<think>x</think>\nSCENE: A referee takes a gold cup from a sad runner "冠军"'))
      .toBe("A referee takes a gold cup from a sad runner");
    expect(() => parseSceneResponse("nope")).toThrow(/malformed scene/);
  });
  it("falls back to the cleaned meaning", () => {
    expect(fallbackScene("build muscle (增加肌肉)")).toBe("a single clear, concrete moment that shows build muscle");
  });
});

describe("unnameGoose", () => {
  it("swaps the character's name for its description so the picture never carries a title", () => {
    expect(unnameGoose("The Chaos Goose sleepwalks past a lamp.")).toBe(`${CHAOS_GOOSE} sleepwalks past a lamp.`);
    expect(buildImagePrompt("the chaos goose trips over a rake")).not.toMatch(/chaos goose/i);
    expect(buildImagePrompt("a goose with a chaos of feathers")).toContain("chaos of feathers");
  });
  it("tells the scene writer to describe the goose, never name it", () => {
    expect(buildScenePrompt("x", "y")).toContain("Never give the goose a name or a title");
    expect(buildScenePrompt("x", "y")).not.toContain("Chaos Goose");
  });
});
