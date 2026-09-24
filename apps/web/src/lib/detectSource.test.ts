import { describe, it, expect } from "vitest";
import { detectSourceType } from "./detectSource";

describe("detectSourceType", () => {
  it("detects sheets", () => {
    expect(detectSourceType("https://docs.google.com/spreadsheets/d/1NvH/edit?usp=sharing")).toBe("google_sheet");
  });
  it("detects docs", () => {
    expect(detectSourceType("https://docs.google.com/document/d/1zyD/edit?tab=t.0")).toBe("google_doc");
  });
  it("rejects anything else", () => {
    expect(detectSourceType("https://canva.com/design/x")).toBeNull();
  });
});
