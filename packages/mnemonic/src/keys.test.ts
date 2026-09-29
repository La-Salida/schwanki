import { describe, it, expect } from "vitest";
import { resolveKeys, isFreePath, shouldDebit } from "./keys.ts";

describe("resolveKeys", () => {
  it("uses the user's keys when they cover every kind", () => {
    const r = resolveKeys({ anthropic: "sk-ant-u", fal: "fal-u", openai: "sk-u" });
    expect(r.sentence).toEqual({ provider: "anthropic", apiKey: "sk-ant-u", ours: false });
    expect(r.image).toEqual({ provider: "fal", apiKey: "fal-u", ours: false });
    expect(r.audio).toEqual({ provider: "openai", apiKey: "sk-u", ours: false });
    expect(isFreePath(r)).toBe(true);
  });
  it("falls back per kind to our keys when a kind is uncovered", () => {
    const r = resolveKeys({ anthropic: "sk-ant-u" }); // no image/audio-capable key
    expect(r.sentence.ours).toBe(false);
    expect(r.image).toEqual({ provider: "fal", apiKey: "", ours: true });
    expect(r.audio).toEqual({ provider: "openai", apiKey: "", ours: true });
    expect(isFreePath(r)).toBe(false);
  });
  it("routes sentences through the user's openrouter key", () => {
    const r = resolveKeys({ openrouter: "sk-or-u" });
    expect(r.sentence).toEqual({ provider: "openrouter", apiKey: "sk-or-u", ours: false });
    expect(r.image.ours).toBe(true);
    expect(r.audio.ours).toBe(true);
    expect(isFreePath(r)).toBe(false);
  });
  it("respects capability order for user keys", () => {
    const r = resolveKeys({ openai: "sk-u", together: "tg-u" }); // no fal
    expect(r.image.provider).toBe("together"); // fal not present → next capable
  });
});

describe("shouldDebit", () => {
  it("debits only when all three kinds succeeded", () => {
    expect(shouldDebit({ sentence: true, image: true, audio: true })).toBe(true);
    expect(shouldDebit({ sentence: true, image: true, audio: false })).toBe(false);
    expect(shouldDebit({ sentence: true, image: false, audio: false })).toBe(false);
    expect(shouldDebit({ sentence: false, image: false, audio: false })).toBe(false);
  });
});
