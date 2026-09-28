import type { MediaKind } from "@schwanki/core";

export type Provider = "anthropic" | "openai" | "fal" | "together" | "higgsfield";

/** Which providers can serve which kind, in preference order. */
export const CAPABILITY: Record<MediaKind, Provider[]> = {
  sentence: ["anthropic", "openai"],
  image: ["fal", "together", "openai", "higgsfield"],
  audio: ["openai", "fal"],
};
