import { describe, expect, it } from "vitest";
import { classDate, groupByTeacher, languageName } from "./groupSources";

const s = (label: string, language: string) => ({ label, language });

describe("groupByTeacher", () => {
  it("groups class PDFs and documents by teacher, then language, newest class first", () => {
    const groups = groupByTeacher([
      s("Ms. Li · 2026-09-16", "zh"),
      s("Kru Nok", "th"),
      s("Ms. Li · 2026-10-07", "zh"),
      s("Ms. Li · 2026-10-01", "en"),
      s("Kru Nok · 2026-09-25", "th"),
    ]);
    expect(groups.map((g) => [g.teacher, g.count])).toEqual([["Kru Nok", 2], ["Ms. Li", 3]]);
    const li = groups[1]!;
    expect(li.languages.map((l) => l.language)).toEqual(["zh", "en"]);
    expect(li.languages[0]!.items.map((i) => i.label)).toEqual(["Ms. Li · 2026-10-07", "Ms. Li · 2026-09-16"]);
  });

  it("treats teacher names case-insensitively", () => {
    expect(groupByTeacher([s("carlos", "es"), s("Carlos · 2026-01-02", "es")])).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("reads class dates and language names", () => {
    expect(classDate("Ms. Li · 2026-09-16")).toBe("2026-09-16");
    expect(classDate("Carlos")).toBeNull();
    expect(languageName("th")).toBe("Thai");
    expect(languageName("pt")).toBe("PT");
  });
});
