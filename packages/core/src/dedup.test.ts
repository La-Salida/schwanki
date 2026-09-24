import { describe, it, expect } from "vitest";
import { dedupKey } from "./dedup.ts";

describe("dedupKey", () => {
  it("normalizes case and whitespace", () => {
    expect(dedupKey(" 自信 ", "zh")).toBe(dedupKey("自信", "zh"));
    expect(dedupKey("Hello ", "en")).toBe(dedupKey("hello", "en"));
  });
  it("is language-scoped", () => {
    expect(dedupKey("hat", "en")).not.toBe(dedupKey("hat", "de"));
  });
});
