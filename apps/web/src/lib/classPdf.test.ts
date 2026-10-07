import { describe, expect, it } from "vitest";
import { classDateFromFilename, classPdfTeacher } from "./classPdf";

describe("class PDF identity", () => {
  it("reads the actual teacher filename as April 14, 2026", () => {
    expect(classDateFromFilename("26-4-14_class_note.pdf")).toBe("2026-04-14");
    expect(classDateFromFilename("2026-04-14_class_note.pdf")).toBe("2026-04-14");
  });
  it("requires a real year-month-day date instead of silently using the upload date", () => {
    expect(classDateFromFilename("lesson.pdf")).toBeNull();
    expect(classDateFromFilename("26-2-30_class_note.pdf")).toBeNull();
    expect(classDateFromFilename("26-13-4_class_note.pdf")).toBeNull();
  });
  it("reuses the teacher without carrying the previous class date into the next class", () => {
    expect(classPdfTeacher("Teacher Chen · 2026-04-14")).toBe("Teacher Chen");
    expect(classPdfTeacher("Teacher Chen")).toBe("Teacher Chen");
  });
});
