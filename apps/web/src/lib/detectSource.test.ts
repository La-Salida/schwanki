import { describe, it, expect } from "vitest";
import { detectSourceType, isCanvaRef } from "./detectSource";

describe("detectSourceType", () => {
  it("detects sheets", () => {
    expect(detectSourceType("https://docs.google.com/spreadsheets/d/1NvH/edit?usp=sharing")).toBe("google_sheet");
  });
  it("detects docs", () => {
    expect(detectSourceType("https://docs.google.com/document/d/1zyD/edit?tab=t.0")).toBe("google_doc");
  });
  it("detects canva design links", () => {
    expect(detectSourceType("https://www.canva.com/design/DAF123abc/view?utm_content=DAF123abc")).toBe("canva");
    expect(detectSourceType("https://canva.com/design/x")).toBe("canva");
  });
  it("rejects anything else", () => {
    expect(detectSourceType("https://example.com/file.pdf")).toBeNull();
    expect(detectSourceType("not a url")).toBeNull();
  });
});

describe("isCanvaRef", () => {
  it("matches canva design urls", () => {
    expect(isCanvaRef("https://www.canva.com/design/DAF123abc/view")).toBe(true);
  });
  it("rejects filenames and other urls", () => {
    expect(isCanvaRef("lesson-3.pdf")).toBe(false);
    expect(isCanvaRef("https://docs.google.com/spreadsheets/d/1NvH")).toBe(false);
  });
});
