// GENERATED from packages/mnemonic/src/types.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";

export type Provider = "anthropic" | "openai" | "openrouter" | "fal" | "together" | "higgsfield";

/** Which providers can serve which kind, in preference order. */
export const CAPABILITY: Record<MediaKind, Provider[]> = {
  sentence: ["anthropic", "openai", "openrouter"],
  image: ["fal", "together", "openai", "higgsfield"],
  audio: ["openai", "fal"],
};
