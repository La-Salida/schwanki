import { describe, it, expect } from "vitest";
import { MODEL_LIST_ENDPOINT, mergeCatalog, parseModelList } from "./catalog.ts";

describe("MODEL_LIST_ENDPOINT", () => {
  it("covers the five providers with listing endpoints, not the curated-only ones", () => {
    expect(Object.keys(MODEL_LIST_ENDPOINT).sort()).toEqual(["anthropic", "elevenlabs", "openai", "openrouter", "together"]);
    expect(MODEL_LIST_ENDPOINT.openrouter?.headers("ignored")).toEqual({}); // public
    expect(MODEL_LIST_ENDPOINT.elevenlabs?.headers("k")).toEqual({ "xi-api-key": "k" });
    expect(MODEL_LIST_ENDPOINT.anthropic?.headers("k")).toMatchObject({ "x-api-key": "k", "anthropic-version": "2023-06-01" });
  });
});

describe("parseModelList", () => {
  it("openrouter: classifies by output modality and skips ~ aliases", () => {
    const out = parseModelList("openrouter", { data: [
      { id: "deepseek/deepseek-chat", name: "DeepSeek: Chat", architecture: { output_modalities: ["text"] } },
      { id: "~deepseek/latest-alias", name: "Alias", architecture: { output_modalities: ["text"] } },
      { id: "google/image-gen", name: "Image Gen", architecture: { output_modalities: ["image"] } },
      { id: "google/gemini", name: "Gemini", architecture: { output_modalities: ["text"], input_modalities: ["text", "image"] } },
    ] });
    expect(out.sentence?.map((m) => m.id)).toEqual(["deepseek/deepseek-chat", "google/gemini"]); // image INPUT ≠ image generation
    expect(out.image?.map((m) => m.id)).toEqual(["google/image-gen"]);
  });
  it("elevenlabs: only can_do_text_to_speech models, keyed by model_id", () => {
    const out = parseModelList("elevenlabs", [
      { model_id: "eleven_v4", name: "Eleven v4", can_do_text_to_speech: true },
      { model_id: "sts_v2", name: "Voice Changer", can_do_text_to_speech: false },
    ] as unknown as JSON);
    expect(out.audio?.map((m) => m.id)).toEqual(["eleven_v4"]);
    expect(out.audio?.[0]?.label).toBe("Eleven v4");
  });
  it("openai: prefix rules route text/tts/image; other models ignored", () => {
    const out = parseModelList("openai", { data: [
      { id: "gpt-4o-mini" },
      { id: "tts-1-hd" },
      { id: "gpt-image-1" },
      { id: "dall-e-3" },
      { id: "whisper-1" },
      { id: "text-embedding-3-small" },
    ] });
    expect(out.sentence?.map((m) => m.id)).toEqual(["gpt-4o-mini"]);
    expect(out.audio?.map((m) => m.id)).toEqual(["tts-1-hd"]);
    expect(out.image?.map((m) => m.id)).toEqual(["gpt-image-1", "dall-e-3"]);
  });
  it("anthropic: everything is a sentence model, display_name preferred", () => {
    const out = parseModelList("anthropic", { data: [{ id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5" }] });
    expect(out.sentence).toEqual([{ id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" }]);
  });
  it("together: image keywords vs chat, accepts bare arrays", () => {
    const out = parseModelList("together", [
      { id: "black-forest-labs/FLUX.1-schnell" },
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
    ] as unknown as JSON);
    expect(out.image?.map((m) => m.id)).toEqual(["black-forest-labs/FLUX.1-schnell"]);
    expect(out.sentence?.map((m) => m.id)).toEqual(["meta-llama/Llama-3.3-70B-Instruct-Turbo"]);
  });
  it("garbage never throws and yields nothing", () => {
    for (const garbage of [null, undefined, 42, "x", {}, { data: {} }, { data: [null, 5, {}] }]) {
      expect(parseModelList("openai", garbage)).toEqual({});
      expect(parseModelList("openrouter", garbage)).toEqual({});
    }
  });
});

describe("mergeCatalog", () => {
  it("curated first, live deduped by id, cap enforced", () => {
    const curated = [{ id: "a", label: "A", provider: "openai" as const }];
    const live = [
      { id: "a", label: "A live dupe", provider: "openai" as const },
      { id: "b", label: "B", provider: "openai" as const },
      ...Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, label: `m${i}`, provider: "openai" as const })),
    ];
    const merged = mergeCatalog(curated, live, 60);
    expect(merged[0]).toEqual(curated[0]);
    expect(merged).toHaveLength(60);
    expect(merged.some((m) => m.id === "b")).toBe(true);
  });
});
