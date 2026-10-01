import { describe, it, expect } from "vitest";
import type { MediaKind } from "@schwanki/core";
import { deckCards, estimateBulk, existingKindsByCard, providerCost, runsForDeck, type CardRef } from "./bulk";

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

describe("providerCost (provider-side $ for BYOK kinds)", () => {
  const catalog = {
    openrouter: { sentence: [{ id: "deepseek/deepseek-chat", label: "DeepSeek", provider: "openrouter" as const, pricingPerM: { in: 0.27, out: 1.1 } }] },
  };
  const RUNS = Array.from({ length: 605 }, () => ({ kinds: ["sentence", "image", "audio"] as MediaKind[] }));

  it("prices sentences from the live catalog and labels media as per-use", () => {
    const cost = providerCost(RUNS, ["sentence", "image", "audio"], ["openrouter", "fal"], catalog);
    // 605 × (350×0.27 + 80×1.1)/1e6 = 605 × 0.0001825 = $0.1104 → "$0.11"
    expect(cost.sentenceTotal).toBe("$0.11");
    expect(cost.perKind.sentence).toContain("on your openrouter key");
    expect(cost.perKind.image).toBe("billed per image on your fal key");
    expect(cost.perKind.audio).toBe("billed per character on your fal key");
  });
  it("uncovered kind falls back to the Schwanki credit price", () => {
    const cost = providerCost([{ kinds: ["image"] as MediaKind[] }], ["image"], ["openrouter"], {});
    expect(cost.perKind.image).toBe("1 credit");
  });
  it("free-tier default model → $0 everywhere", () => {
    const freeCatalog = { openrouter: { sentence: [{ id: "deepseek/deepseek-chat", label: "Free", provider: "openrouter" as const, pricingPerM: { in: 0, out: 0 } }] } };
    const cost = providerCost([{ kinds: ["sentence"] as MediaKind[] }], ["sentence"], ["openrouter"], freeCatalog);
    expect(cost.perKind.sentence).toBe("$0 — free-tier model");
    expect(cost.sentenceTotal).toBe("$0 (free-tier model)");
  });
  it("no catalog pricing → honest 'on your key' hint, no invented $", () => {
    const cost = providerCost([{ kinds: ["sentence"] as MediaKind[] }], ["sentence"], ["openrouter"], {});
    expect(cost.perKind.sentence).toContain("your openrouter key");
    expect(cost.sentenceTotal).toBeUndefined();
  });
});
