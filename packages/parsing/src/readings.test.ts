import { describe, expect, it, vi } from "vitest";
import { needsReading } from "@schwanki/core";
import { suggestReadings } from "./readings.ts";

const cards = [{ front: "明显", back: "obvious" }, { front: "行", back: "to be OK" }];

describe("needsReading", () => {
  it("is true for scripts learners cannot sound out, false for Latin-script languages", () => {
    expect(needsReading("zh")).toBe(true);
    expect(needsReading("JA")).toBe(true);
    expect(needsReading("es")).toBe(false);
    expect(needsReading("vi")).toBe(false);
  });
});

describe("suggestReadings", () => {
  it("asks for the language's reading style and keeps only readings for the words sent", async () => {
    const parseCards = vi.fn().mockResolvedValue({ cards: [
      { front: "明显", back: "obvious", reading: " míng xiǎn " },
      { front: "行", back: "to be OK", reading: "" },
      { front: "别的", reading: "bié de" },
    ] });
    const got = await suggestReadings("zh", cards, { parseCards });
    expect(parseCards.mock.calls[0]![0]).toContain("pinyin with tone marks");
    expect(parseCards.mock.calls[0]![0]).toContain('"front":"行"');
    expect([...got]).toEqual([["明显", "míng xiǎn"]]);
  });

  it("drops a reading that just repeats the word, and refuses to run for a Latin-script language", async () => {
    const parseCards = vi.fn().mockResolvedValue({ cards: [{ front: "明显", reading: "明显" }] });
    expect((await suggestReadings("zh", cards, { parseCards })).size).toBe(0);
    expect((await suggestReadings("es", [{ front: "hola", back: "hi" }], { parseCards })).size).toBe(0);
    expect(parseCards).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when the model returns no card list", async () => {
    await expect(suggestReadings("ja", cards, { parseCards: async () => ({}) })).rejects.toThrow(/no readings/);
  });
});
