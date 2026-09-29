// GENERATED from packages/mnemonic/src/pricing.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";

/** Credits charged per generated kind; sentences are free. */
export const CREDIT_COST: Record<MediaKind, number> = {
  sentence: 0,
  image: 1,
  audio: 1,
};

/**
 * Credits for a run of kinds: image + audio together form a "scene bundle"
 * capped at 1 credit; otherwise the per-kind costs are summed.
 * Duplicate entries are collapsed here for robustness, but deduping is
 * upstream's job (normalizeKinds) — callers should pass canonical kind lists.
 */
export function runCost(kinds: MediaKind[]): number {
  const unique = [...new Set(kinds)];
  if (unique.includes("image") && unique.includes("audio")) return 1;
  return unique.reduce((n, k) => n + CREDIT_COST[k], 0);
}
