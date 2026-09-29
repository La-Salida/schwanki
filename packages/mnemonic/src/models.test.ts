import { describe, it, expect } from "vitest";
import { SENTENCE_MODELS, sentenceProviderForModel } from "./models.ts";
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

describe("sentenceProviderForModel", () => {
  it("maps registered ids to their provider", () => {
    expect(sentenceProviderForModel("claude-sonnet-4-5")).toBe("anthropic");
    expect(sentenceProviderForModel("gpt-4o-mini")).toBe("openai");
    expect(sentenceProviderForModel("deepseek/deepseek-chat")).toBe("openrouter");
  });
  it("routes any slug containing a slash to openrouter", () => {
    expect(sentenceProviderForModel("z-ai/glm-9")).toBe("openrouter");
    expect(sentenceProviderForModel("anthropic/claude-haiku-4.5")).toBe("openrouter");
  });
  it("returns undefined for empty or whitespace ids", () => {
    expect(sentenceProviderForModel("")).toBeUndefined();
    expect(sentenceProviderForModel("   ")).toBeUndefined();
  });
  it("falls back to prefix heuristics for unregistered ids", () => {
    expect(sentenceProviderForModel("claude-opus-9")).toBe("anthropic");
  });
});
