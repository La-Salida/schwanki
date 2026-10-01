// GENERATED from packages/mnemonic/src/models.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";
import type { Provider } from "./types.ts";

export interface ModelOption { id: string; label: string; provider: Provider; pricing?: string }

/** Curated sentence models for the picker; `id` is what we send to the provider. */
export const SENTENCE_MODELS: ModelOption[] = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", provider: "openai" },
  { id: "gpt-5-mini", label: "GPT-5 mini", provider: "openai" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat (OpenRouter)", provider: "openrouter" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1 (OpenRouter)", provider: "openrouter" },
  { id: "z-ai/glm-4.6", label: "GLM 4.6 (OpenRouter)", provider: "openrouter" },
  { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash (OpenRouter)", provider: "openrouter" },
  { id: "z-ai/glm-5.2:free", label: "GLM 5.2 Free (OpenRouter)", provider: "openrouter" },
];

/** Curated image models; `id` goes in the URL path (fal) or JSON body (others). */
export const IMAGE_MODELS: ModelOption[] = [
  { id: "fal-ai/fast-sdxl", label: "Fast SDXL (fal)", provider: "fal" },
  { id: "fal-ai/flux/schnell", label: "FLUX Schnell (fal)", provider: "fal" },
  { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 Schnell (Together)", provider: "together" },
  { id: "gpt-image-1", label: "GPT Image 1", provider: "openai" },
  { id: "gpt-image-1-mini", label: "GPT Image 1 Mini", provider: "openai" },
];

/** Curated TTS models; `id` goes in the URL path (fal), body model_id (ElevenLabs),
 *  or the `model` request header (Fish Audio). */
export const AUDIO_MODELS: ModelOption[] = [
  { id: "eleven_v4", label: "ElevenLabs v4 (best)", provider: "elevenlabs" },
  { id: "eleven_flash_v2_5", label: "ElevenLabs Flash (fastest)", provider: "elevenlabs" },
  { id: "eleven_multilingual_v2", label: "ElevenLabs Multilingual v2 (stable)", provider: "elevenlabs" },
  { id: "s2.1-pro", label: "Fish Audio s2.1 Pro", provider: "fish" },
  { id: "s2.1-pro-free", label: "Fish Audio s2.1 Pro (free tier)", provider: "fish" },
  { id: "s1", label: "Fish Audio s1 (fast)", provider: "fish" },
  { id: "tts-1", label: "OpenAI TTS", provider: "openai" },
  { id: "tts-1-hd", label: "OpenAI TTS HD", provider: "openai" },
  { id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS", provider: "openai" },
  { id: "fal-ai/elevenlabs/tts/multilingual-v2", label: "ElevenLabs via fal", provider: "fal" },
];

const registries: Record<MediaKind, Map<string, Provider>> = {
  sentence: new Map(SENTENCE_MODELS.map((m) => [m.id, m.provider])),
  image: new Map(IMAGE_MODELS.map((m) => [m.id, m.provider])),
  audio: new Map(AUDIO_MODELS.map((m) => [m.id, m.provider])),
};

/** Model id → provider for a kind. Registry hit wins; otherwise per-kind prefix heuristics:
 *  sentence: `/` → openrouter, `claude*` → anthropic, `gpt-`/`o3`/`o4` → openai;
 *  image: `fal-ai/` → fal, `black-forest-labs/` → together, no slash → openai;
 *  audio: `/` → fal, no slash → openai.
 *  Empty/whitespace → undefined; unresolvable non-empty → undefined. */
export function providerForModel(kind: MediaKind, id: string): Provider | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const registered = registries[kind].get(trimmed);
  if (registered) return registered;
  if (kind === "sentence") {
    if (trimmed.includes("/")) return "openrouter";
    if (trimmed.startsWith("claude")) return "anthropic";
    if (trimmed.startsWith("gpt-") || trimmed.startsWith("o3") || trimmed.startsWith("o4")) return "openai";
    return undefined;
  }
  if (kind === "image") {
    if (trimmed.startsWith("fal-ai/")) return "fal";
    if (trimmed.startsWith("black-forest-labs/")) return "together";
    if (!trimmed.includes("/")) return "openai";
    return undefined;
  }
  // audio: eleven* → ElevenLabs direct; slash → fal (fal.run path); otherwise OpenAI.
  if (trimmed.startsWith("eleven")) return "elevenlabs";
  return trimmed.includes("/") ? "fal" : "openai";
}
