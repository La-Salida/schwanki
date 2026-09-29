// GENERATED from packages/mnemonic/src/models.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { Provider } from "./types.ts";

export interface SentenceModel { id: string; label: string; provider: Provider }

/** Curated sentence models for the picker; `id` is what we send to the provider. */
export const SENTENCE_MODELS: SentenceModel[] = [
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

const registry = new Map(SENTENCE_MODELS.map((m) => [m.id, m.provider]));

/** Model id → provider. Registry hit wins; otherwise prefix heuristics: `claude*` → anthropic, `gpt-`/`o3`/`o4` → openai, any slug containing `/` → openrouter. Empty/whitespace → undefined. */
export function sentenceProviderForModel(id: string): Provider | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const registered = registry.get(trimmed);
  if (registered) return registered;
  if (trimmed.includes("/")) return "openrouter";
  if (trimmed.startsWith("claude")) return "anthropic";
  if (trimmed.startsWith("gpt-") || trimmed.startsWith("o3") || trimmed.startsWith("o4")) return "openai";
  return undefined;
}
