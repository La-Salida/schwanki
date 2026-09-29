import { describe, it, expect } from "vitest";
import { capabilityCoverage, allKindsCovered } from "./capabilities.ts";

describe("capabilityCoverage", () => {
  it("covers nothing with no saved providers", () => {
    const cov = capabilityCoverage([]);
    expect(cov.sentence.covered).toBe(false);
    expect(cov.image.covered).toBe(false);
    expect(cov.audio.covered).toBe(false);
    expect(cov.sentence.via).toEqual([]);
  });
  it("openai alone covers all three kinds", () => {
    const cov = capabilityCoverage(["openai"]);
    expect(cov.sentence.covered).toBe(true);
    expect(cov.image.covered).toBe(true);
    expect(cov.audio.covered).toBe(true);
  });
  it("fal covers image and audio but not sentence", () => {
    const cov = capabilityCoverage(["fal"]);
    expect(cov.image.covered).toBe(true);
    expect(cov.audio.covered).toBe(true);
    expect(cov.sentence.covered).toBe(false);
  });
  it("openrouter covers sentence only", () => {
    const cov = capabilityCoverage(["openrouter"]);
    expect(cov.sentence.covered).toBe(true);
    expect(cov.image.covered).toBe(false);
    expect(cov.audio.covered).toBe(false);
  });
  it("anthropic + together cover sentence and image but not audio", () => {
    const cov = capabilityCoverage(["anthropic", "together"]);
    expect(cov.sentence.covered).toBe(true);
    expect(cov.image.covered).toBe(true);
    expect(cov.audio.covered).toBe(false);
  });
  it("via lists every capable saved provider", () => {
    const cov = capabilityCoverage(["openai", "fal"]);
    expect(cov.image.via).toHaveLength(2);
    expect(cov.image.via).toEqual(expect.arrayContaining(["fal", "openai"]));
  });
});

describe("allKindsCovered", () => {
  it("is true when saved providers cover every kind between them", () => {
    expect(allKindsCovered(["openrouter", "fal"])).toBe(true); // sentence via openrouter, image+audio via fal
  });
  it("is true when a single provider covers every kind", () => {
    expect(allKindsCovered(["openai"])).toBe(true);
  });
  it("is false when any kind is uncovered", () => {
    expect(allKindsCovered([])).toBe(false);
    expect(allKindsCovered(["openrouter"])).toBe(false); // no image/audio
    expect(allKindsCovered(["anthropic", "together"])).toBe(false); // no audio
  });
});
