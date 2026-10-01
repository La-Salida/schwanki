import { describe, it, expect } from "vitest";
import type { MediaKind } from "@schwanki/core";
import { deckCards, estimateBulk, existingKindsByCard, runsForDeck, type CardRef } from "./bulk";

const REF = (id: string, sourceId: string | null, language = "zh"): CardRef => ({ id, front: `w${id}`, sourceId, language });
const ALL: MediaKind[] = ["sentence", "image", "audio"];

describe("deckCards", () => {
  const refs = [REF("1", "s1"), REF("2", "s2"), REF("3", null, "ko")];
  it("scopes by teacher (source) or language across teachers", () => {
    expect(deckCards(refs, { by: "source", value: "s1" }).map((r) => r.id)).toEqual(["1"]);
    expect(deckCards(refs, { by: "language", value: "zh" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(deckCards(refs, { by: "language", value: "ko" }).map((r) => r.id)).toEqual(["3"]);
  });
});

describe("runsForDeck / existingKindsByCard", () => {
  it("targets only cards missing requested kinds; full request for uncovered cards", () => {
    const existing = existingKindsByCard([{ cardId: "1", kind: "sentence" }]);
    const runs = runsForDeck([REF("1", "s1"), REF("2", "s1")], existing, ALL, true);
    expect(runs).toEqual([
      { cardId: "1", front: "w1", kinds: ["image", "audio"] },
      { cardId: "2", front: "w2", kinds: ALL },
    ]);
  });
  it("skipExisting off regenerates everything", () => {
    const existing = existingKindsByCard([{ cardId: "1", kind: "sentence" }]);
    const runs = runsForDeck([REF("1", "s1")], existing, ["sentence"], false);
    expect(runs).toEqual([{ cardId: "1", front: "w1", kinds: ["sentence"] }]);
  });
});

describe("estimateBulk (mirrors server pricing)", () => {
  it("all kinds covered by user keys → 0 credits", () => {
    // openrouter (sentence) + fal (image, audio)
    expect(estimateBulk([{ kinds: ALL }], ["openrouter", "fal"])).toEqual({ cards: 1, credits: 0, freeEverything: true });
  });
  it("nothing covered → scene cap: full scene = 1, image+audio = 1, sentence alone = 0", () => {
    expect(estimateBulk([{ kinds: ALL }], []).credits).toBe(1);
    expect(estimateBulk([{ kinds: ["image", "audio"] }], []).credits).toBe(1);
    expect(estimateBulk([{ kinds: ["sentence"] }, { kinds: ["sentence"] }], []).credits).toBe(0);
  });
  it("partial coverage: user covers text, our keys cover media → 1 credit per full card", () => {
    const est = estimateBulk([{ kinds: ALL }, { kinds: ["image"] }], ["openrouter"]);
    expect(est.credits).toBe(2); // scene card caps at 1, image-only card 1
    expect(est.freeEverything).toBe(false);
  });
  it("empty deck → zero", () => {
    expect(estimateBulk([], ["openrouter"])).toEqual({ cards: 0, credits: 0, freeEverything: true });
  });
});
