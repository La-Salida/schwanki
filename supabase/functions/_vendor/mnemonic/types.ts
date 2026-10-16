// GENERATED from packages/mnemonic/src/types.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";

export type Provider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "deepseek"
  | "fal"
  | "together"
  | "higgsfield"
  | "elevenlabs"
  | "fish";

/** Which providers can serve which kind, in preference order. */
export const CAPABILITY: Record<MediaKind, Provider[]> = {
  sentence: ["anthropic", "openai", "openrouter", "deepseek"],
  image: ["fal", "together", "openai", "higgsfield"],
  // Native-voice providers first: ElevenLabs direct is also the our-key backup.
  audio: ["elevenlabs", "fish", "openai", "fal"],
};

/** Schwanki AI: the provider our own (server) keys use per kind when the user has
 *  no key for it. Users with keys can pick any model their providers offer. */
export const SERVER_DEFAULT: Record<MediaKind, Provider> = {
  sentence: "deepseek",
  image: "fal",
  audio: "elevenlabs",
};
