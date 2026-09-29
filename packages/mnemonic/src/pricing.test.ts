import { describe, it, expect } from "vitest";
import { CREDIT_COST, runCost } from "./pricing.ts";

describe("CREDIT_COST", () => {
  it("sentences are free; image and audio cost 1 each", () => {
    expect(CREDIT_COST).toEqual({ sentence: 0, image: 1, audio: 1 });
  });
});

describe("runCost", () => {
  it("empty run costs 0", () => {
    expect(runCost([])).toBe(0);
  });
  it("sentence-only run costs 0", () => {
    expect(runCost(["sentence"])).toBe(0);
  });
  it("image-only run costs 1", () => {
    expect(runCost(["image"])).toBe(1);
  });
  it("audio-only run costs 1", () => {
    expect(runCost(["audio"])).toBe(1);
  });
  it("sentence + image costs 1", () => {
    expect(runCost(["sentence", "image"])).toBe(1);
  });
  it("image + audio hits the scene-bundle cap of 1", () => {
    expect(runCost(["image", "audio"])).toBe(1);
  });
  it("all three kinds hits the scene-bundle cap of 1", () => {
    expect(runCost(["sentence", "image", "audio"])).toBe(1);
  });
  it("duplicate image entries still cost 1 (dedupe is the caller's job)", () => {
    expect(runCost(["image", "image"])).toBe(1);
  });
});
