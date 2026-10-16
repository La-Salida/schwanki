import type { MediaKind } from "@schwanki/core";
import { CAPABILITY, SERVER_DEFAULT, type Provider } from "./types.ts";

export interface ResolvedKey { provider: Provider; apiKey: string; ours: boolean }

/** Per kind: user's first capable key wins; otherwise our key slot for SERVER_DEFAULT (apiKey filled by the edge function env). */
export function resolveKeys(userKeys: Partial<Record<Provider, string>>): Record<MediaKind, ResolvedKey> {
  const out = {} as Record<MediaKind, ResolvedKey>;
  for (const kind of ["sentence", "image", "audio"] as MediaKind[]) {
    const capable = CAPABILITY[kind];
    const userProvider = capable.find((p) => userKeys[p]);
    out[kind] = userProvider
      ? { provider: userProvider, apiKey: userKeys[userProvider]!, ours: false }
      : { provider: SERVER_DEFAULT[kind], apiKey: "", ours: true };
  }
  return out;
}

export function isFreePath(r: Record<MediaKind, ResolvedKey>): boolean {
  return !r.sentence.ours && !r.image.ours && !r.audio.ours;
}

/** @deprecated Superseded by per-kind pricing (see pricing.ts runCost) — kept for API compat, unused by the edge function. */
export function shouldDebit(outcome: { sentence: boolean; image: boolean; audio: boolean }): boolean {
  return outcome.sentence && outcome.image && outcome.audio;
}
