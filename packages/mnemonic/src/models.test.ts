import { describe, it, expect } from "vitest";
import { SENTENCE_MODELS, IMAGE_MODELS, AUDIO_MODELS, providerForModel } from "./models.ts";
import type { Provider } from "./types.ts";

describe("SENTENCE_MODELS", () => {
  it("contains the 10 curated models with the right providers", () => {
    expect(SENTENCE_MODELS).toHaveLength(10);
    const expected: Array<[string, Provider]> = [
      ["claude-haiku-4-5", "anthropic"],
      ["claude-sonnet-4-5", "anthropic"],
      ["gpt-4o-mini", "openai"],
      ["gpt-4.1-mini", "openai"],
      ["gpt-5-mini", "openai"],
      ["deepseek/deepseek-chat", "openrouter"],
      ["deepseek/deepseek-r1", "openrouter"],
      ["z-ai/glm-4.6", "openrouter"],
      ["z-ai/glm-5.3-flash", "openrouter"],
      ["z-ai/glm-5.2:free", "openrouter"],
    ];
    const byId = new Map(SENTENCE_MODELS.map((m) => [m.id, m.provider] as const));
    for (const [id, provider] of expected) expect(byId.get(id)).toBe(provider);
  });
  it("labels every model for the picker", () => {
    for (const m of SENTENCE_MODELS) {
      expect(m.id.trim().length).toBeGreaterThan(0);
      expect(m.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("IMAGE_MODELS", () => {
  it("contains the 5 curated models with the right providers", () => {
    expect(IMAGE_MODELS).toHaveLength(5);
    const expected: Array<[string, Provider]> = [
      ["fal-ai/fast-sdxl", "fal"],
      ["fal-ai/flux/schnell", "fal"],
      ["black-forest-labs/FLUX.1-schnell", "together"],
      ["gpt-image-1", "openai"],
      ["gpt-image-1-mini", "openai"],
    ];
    const byId = new Map(IMAGE_MODELS.map((m) => [m.id, m.provider] as const));
    for (const [id, provider] of expected) expect(byId.get(id)).toBe(provider);
  });
  it("labels every model for the picker", () => {
    for (const m of IMAGE_MODELS) {
      expect(m.id.trim().length).toBeGreaterThan(0);
      expect(m.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("AUDIO_MODELS", () => {
  it("contains the 4 curated models with the right providers", () => {
    // Brief enumerates 4 ids (openai: tts-1, tts-1-hd, gpt-4o-mini-tts; fal: elevenlabs v2)
    // though its count says 5 — the enumerated list is the spec.
    expect(AUDIO_MODELS).toHaveLength(4);
    const expected: Array<[string, Provider]> = [
      ["tts-1", "openai"],
      ["tts-1-hd", "openai"],
      ["gpt-4o-mini-tts", "openai"],
      ["fal-ai/elevenlabs/tts/multilingual-v2", "fal"],
    ];
    const byId = new Map(AUDIO_MODELS.map((m) => [m.id, m.provider] as const));
    for (const [id, provider] of expected) expect(byId.get(id)).toBe(provider);
  });
  it("labels every model for the picker", () => {
    for (const m of AUDIO_MODELS) {
      expect(m.id.trim().length).toBeGreaterThan(0);
      expect(m.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("providerForModel", () => {
  it("resolves registered ids to their registry provider (registry wins)", () => {
    expect(providerForModel("sentence", "claude-sonnet-4-5")).toBe("anthropic");
    expect(providerForModel("sentence", "z-ai/glm-4.6")).toBe("openrouter");
    expect(providerForModel("image", "gpt-image-1-mini")).toBe("openai");
    expect(providerForModel("image", "fal-ai/fast-sdxl")).toBe("fal");
    expect(providerForModel("audio", "fal-ai/elevenlabs/tts/multilingual-v2")).toBe("fal");
  });
  it("sentence heuristics: slash → openrouter, claude* → anthropic, gpt-/o3/o4 → openai", () => {
    expect(providerForModel("sentence", "z-ai/glm-9")).toBe("openrouter");
    expect(providerForModel("sentence", "claude-opus-9")).toBe("anthropic");
    expect(providerForModel("sentence", "o3-mini")).toBe("openai");
    expect(providerForModel("sentence", "o4-mini")).toBe("openai");
  });
  it("image heuristics: fal-ai/ → fal, black-forest-labs/ → together, no slash → openai", () => {
    expect(providerForModel("image", "fal-ai/flux/dev")).toBe("fal");
    expect(providerForModel("image", "black-forest-labs/FLUX.1-dev")).toBe("together");
    expect(providerForModel("image", "sdxl")).toBe("openai");
  });
  it("audio heuristics: slash → fal, no slash → openai", () => {
    expect(providerForModel("audio", "elevenlabs/v3")).toBe("fal");
    expect(providerForModel("audio", "tts-1-hd")).toBe("openai");
  });
  it("returns undefined for empty or whitespace ids", () => {
    expect(providerForModel("image", "")).toBeUndefined();
    expect(providerForModel("sentence", "   ")).toBeUndefined();
  });
  it("returns undefined for unresolvable non-empty ids (image slugs are never openrouter)", () => {
    expect(providerForModel("image", "z-ai/glm-4.6")).toBeUndefined();
    expect(providerForModel("sentence", "grok-9")).toBeUndefined();
  });
});
