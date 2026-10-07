import { describe, it, expect } from "vitest";
import type { MediaKind } from "@schwanki/core";
import { chunk, deckCards, estimateBulk, existingKindsByCard, providerCost, runsForDeck, summarizeJobs, type CardRef } from "./bulk";

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
  const line = (c: ReturnType<typeof providerCost>, k: string) => c.lines.find((l) => l.kind === k)?.text;

  it("prices everything: sentences at live rates, images/audio at typical rates", () => {
    const c = providerCost(RUNS, ["sentence", "image", "audio"], ["openrouter", "fal", "elevenlabs"], catalog);
    // 605 × (350×0.27 + 80×1.1)/1e6 = $0.1104
    expect(line(c, "sentence")).toBe("sentences ≈ $0.11 total (deepseek/deepseek-chat at live rates)");
    // 605 × $0.003 = $1.815 → toFixed(2) lands on 1.81 (float storage)
    expect(line(c, "image")).toBe("images ≈ $1.81 total (fal-ai/fast-sdxl)");
    // 605 × $0.00008/char × ~40 chars = $1.936
    expect(line(c, "audio")).toBe("audio ≈ $1.94 total (eleven_v4, ~40 chars each)");
    expect(c.perKind.image).toBe("≈$0.003/image on your fal key");
    expect(c.perKind.audio).toBe("≈$0.003/card on your elevenlabs key");
  });
  it("uncovered kind falls back to the Schwanki credit price", () => {
    const c = providerCost([{ kinds: ["image"] as MediaKind[] }], ["image"], ["openrouter"], {});
    expect(c.perKind.image).toBe("1 credit");
    expect(line(c, "image")).toContain("1 Schwanki credit");
  });
  it("free-tier default model → $0 everywhere", () => {
    const freeCatalog = { openrouter: { sentence: [{ id: "deepseek/deepseek-chat", label: "Free", provider: "openrouter" as const, pricingPerM: { in: 0, out: 0 } }] } };
    const c = providerCost([{ kinds: ["sentence"] as MediaKind[] }], ["sentence"], ["openrouter"], freeCatalog);
    expect(c.perKind.sentence).toBe("$0 (free-tier model)");
    expect(line(c, "sentence")).toBe("sentences $0 (free-tier model)");
  });
  it("no catalog pricing and no typical rate → honest 'on your key', no invented $", () => {
    const noPrice = providerCost([{ kinds: ["sentence"] as MediaKind[] }], ["sentence"], ["openrouter"], {});
    expect(noPrice.perKind.sentence).toContain("your openrouter key");
    expect(line(noPrice, "sentence")).toContain("your openrouter key");
    // fish covers audio but has no published typical rate → billed-by phrasing, no $
    const fish = providerCost([{ kinds: ["audio"] as MediaKind[] }], ["audio"], ["fish"], {});
    expect(fish.perKind.audio).toBe("billed per character on your fish key");
  });
});

describe("queue helpers", () => {
  it("chunks inserts at 100", () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(chunk([])).toEqual([]);
  });
  it("summarizes job states", () => {
    const rows = [
      { status: "done", error: null }, { status: "done", error: null },
      { status: "failed", error: "x" }, { status: "pending", error: null },
      { status: "running", error: null },
    ];
    expect(summarizeJobs(rows)).toEqual({ done: 2, failed: 1, queued: 1, active: 1 });
  });
});
