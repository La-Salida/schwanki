// GENERATED from packages/mnemonic/src/capabilities.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";
import { CAPABILITY, type Provider } from "./types.ts";

export interface KindCoverage { covered: boolean; via: Provider[] }

/** Free-path coverage: a kind is covered iff the user has ≥1 saved key for a capable provider.
 *  `via` lists every capable provider the user has saved, in CAPABILITY preference order. */
export function capabilityCoverage(saved: Provider[]): Record<"sentence" | "image" | "audio", KindCoverage> {
  const savedSet = new Set(saved);
  const out = {} as Record<MediaKind, KindCoverage>;
  for (const kind of ["sentence", "image", "audio"] as MediaKind[]) {
    const via = CAPABILITY[kind].filter((p) => savedSet.has(p));
    out[kind] = { covered: via.length > 0, via };
  }
  return out;
}

/** True when the saved keys alone can serve every kind (free generation path). */
export function allKindsCovered(saved: Provider[]): boolean {
  const cov = capabilityCoverage(saved);
  return cov.sentence.covered && cov.image.covered && cov.audio.covered;
}
