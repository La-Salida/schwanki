import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DueCard } from "@schwanki/core";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke } } }));

import { fillMissingReadings, missingReadings, resetReadingRequests, withReadings } from "./readings";

function due(id: string, language: string, reading?: string): DueCard {
  return { card: { id, userId: "u", sourceId: null, language, front: id, back: "x", createdAt: "", ...(reading === undefined ? {} : { reading }) }, state: {} as DueCard["state"] };
}

beforeEach(() => { invoke.mockReset(); resetReadingRequests(); Object.defineProperty(navigator, "onLine", { value: true, configurable: true }); });

describe("missingReadings", () => {
  it("wants only unread cards in languages that need a reading", () => {
    const cards = [due("a", "zh"), due("b", "zh", "ā"), due("c", "es"), due("d", "ja", "  ")];
    expect(missingReadings(cards).map((d) => d.card.id)).toEqual(["a", "d"]);
  });
});

describe("fillMissingReadings", () => {
  it("asks the server once per card and returns the readings it filled", async () => {
    invoke.mockResolvedValue({ data: { readings: { a: "ā", d: "" } }, error: null });
    const cards = [due("a", "zh"), due("d", "ja"), due("c", "es")];
    expect(await fillMissingReadings(cards)).toEqual({ a: "ā" });
    expect(invoke).toHaveBeenCalledWith("add-readings", { body: { cardIds: ["a", "d"] } });
    // Nothing new to ask for on the next load: the skipped card is not retried.
    expect(await fillMissingReadings(cards)).toEqual({});
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the server fails or the device is offline", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("boom") });
    expect(await fillMissingReadings([due("a", "zh")])).toEqual({});
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    expect(await fillMissingReadings([due("b", "zh")])).toEqual({});
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("withReadings", () => {
  it("patches matching cards and leaves the rest alone", () => {
    const cards = [due("a", "zh"), due("b", "zh")];
    const next = withReadings(cards, { a: "ā" });
    expect(next[0]!.card.reading).toBe("ā");
    expect(next[1]).toBe(cards[1]);
  });
});
