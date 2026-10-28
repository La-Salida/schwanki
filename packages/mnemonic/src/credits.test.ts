import { describe, it, expect } from "vitest";
import { CREDIT_PACKS, findCreditPack, formatPrice, serverCoverage } from "./credits.ts";

describe("credit packs", () => {
  it("finds packs by id only", () => {
    expect(findCreditPack("plus")?.credits).toBe(500);
    expect(findCreditPack("mini")).toMatchObject({ credits: 20, priceCents: 100 });
    expect(findCreditPack("free-money")).toBeUndefined();
    expect(findCreditPack(undefined)).toBeUndefined();
  });
  it("bigger packs never cost more per credit", () => {
    const perCredit = CREDIT_PACKS.map((p) => p.priceCents / p.credits);
    expect([...perCredit].sort((a, b) => b - a)).toEqual(perCredit);
  });
  it("formats whole and fractional dollars", () => {
    expect(formatPrice(500)).toBe("$5");
    expect(formatPrice(5)).toBe("$0.05");
  });
});

describe("serverCoverage", () => {
  it("reports a kind available when its fallback provider has a server key", () => {
    expect(serverCoverage((p) => p === "deepseek" || p === "elevenlabs")).toEqual({ sentence: true, image: false, audio: true });
  });
});
