import { describe, it, expect } from "vitest";
import { validateLanguage } from "./language";

describe("validateLanguage", () => {
  it("accepts CJK fronts for zh", () => {
    expect(validateLanguage("自信", "zh")).toBe(true);
    expect(validateLanguage("未來感", "zh")).toBe(true); // traditional also fine
  });
  it("rejects pure-English fronts for zh (cross-language contamination)", () => {
    expect(validateLanguage("confidence", "zh")).toBe(false);
  });
  it("accepts Thai script for th, rejects Latin", () => {
    expect(validateLanguage("ส่ง", "th")).toBe(true);
    expect(validateLanguage("song", "th")).toBe(false);
  });
  it("passes unknown languages through", () => {
    expect(validateLanguage("anything", "eo")).toBe(true);
  });
});
