import type { MediaKind } from "@schwanki/core";
import { CREDIT_COST, DEFAULT_MODELS, capabilityCoverage, type ModelOption, type Provider } from "@schwanki/mnemonic";

export interface CardRef { id: string; front: string; sourceId: string | null; language: string }
export type DeckScope = { by: "source"; value: string } | { by: "language"; value: string };

export function deckCards(refs: CardRef[], scope: DeckScope): CardRef[] {
  return refs.filter((r) =>
    scope.by === "source" ? r.sourceId === scope.value : r.language === scope.value,
  );
}

/** cardId → kinds that already exist. */
export function existingKindsByCard(media: Array<{ cardId: string; kind: MediaKind }>): Map<string, Set<MediaKind>> {
  const map = new Map<string, Set<MediaKind>>();
  for (const m of media) {
    const set = map.get(m.cardId) ?? new Set<MediaKind>();
    set.add(m.kind);
    map.set(m.cardId, set);
  }
  return map;
}

export interface BulkEstimate {
  cards: number; // cards that will be generated
  credits: number; // what the run will cost in Schwanki credits (mirrors server rules)
  freeEverything: boolean;
  perRunKinds: Array<{ cardId: string; front: string; kinds: MediaKind[] }>;
}

/** Which of the requested kinds each card still needs (skip-existing). */
export function runsForDeck(
  refs: CardRef[],
  existing: Map<string, Set<MediaKind>>,
  requested: MediaKind[],
  skipExisting: boolean,
): Array<{ cardId: string; front: string; kinds: MediaKind[] }> {
  const runs: Array<{ cardId: string; front: string; kinds: MediaKind[] }> = [];
  for (const r of refs) {
    const have = existing.get(r.id) ?? new Set<MediaKind>();
    const kinds = requested.filter((k) => !skipExisting || !have.has(k));
    if (kinds.length > 0) runs.push({ cardId: r.id, front: r.front, kinds });
  }
  return runs;
}

/** Exact cost preview, mirroring the server: per card, kinds resolved BYOK-first
 *  (coverage) cost 0 when user-keyed; image+audio both on our keys = scene cap 1.
 *  Bulk always uses smart-pick models, so the estimate cannot drift from the bill. */
export function estimateBulk(
  runs: Array<{ kinds: MediaKind[] }>,
  savedProviders: Provider[],
): { cards: number; credits: number; freeEverything: boolean } {
  const coverage = capabilityCoverage(savedProviders);
  let credits = 0;
  let oursAny = false;
  for (const run of runs) {
    const ours = run.kinds.filter((k) => !coverage[k].covered);
    const media = ours.filter((k) => k === "image" || k === "audio");
    credits += media.length >= 2 ? 1 : ours.reduce((n, k) => n + CREDIT_COST[k], 0);
    if (ours.length > 0) oursAny = true;
  }
  return { cards: runs.length, credits, freeEverything: !oursAny };
}

/** Rough per-sentence token footprint for $ estimates (scene prompt in, 2 lines out). */
const SENTENCE_TOKENS = { in: 350, out: 80 };

const usdSmart = (n: number): string =>
  n >= 0.01 ? n.toFixed(2) : n >= 0.001 ? n.toFixed(3) : n.toFixed(4);

export type CatalogMap = Partial<Record<Provider, Partial<Record<MediaKind, ModelOption[]>>>>;

export interface ProviderCost {
  /** Per-kind checkbox hint: which key serves it + $ when computable, or the credit price. */
  perKind: Partial<Record<MediaKind, string>>;
  /** Deck-total $ for sentences when the smart-pick model's live pricing is known. */
  sentenceTotal?: string;
  /** The model the sentence estimate is based on (named so the user can judge it). */
  sentenceModel?: string;
}

/** Provider-side cost for BYOK kinds: real $ when the live catalog prices the
 *  smart-pick default model (OpenRouter per-1M-token rates); otherwise an honest
 *  "on your {provider} key" — never an invented number. */
export function providerCost(
  runs: Array<{ kinds: MediaKind[] }>,
  kinds: MediaKind[],
  savedProviders: Provider[],
  catalog: CatalogMap,
): ProviderCost {
  const coverage = capabilityCoverage(savedProviders);
  const perKind: Partial<Record<MediaKind, string>> = {};
  let sentencePerCard: number | null | undefined; // undefined=unknown, null=free tier
  for (const kind of kinds) {
    const via = coverage[kind].via[0];
    if (!via) {
      perKind[kind] = "1 credit";
      continue;
    }
    const modelId = DEFAULT_MODELS[via]?.[kind];
    const model = modelId ? catalog[via]?.[kind]?.find((m) => m.id === modelId) : undefined;
    const perM = model?.pricingPerM;
    if (kind === "sentence" && perM) {
      const perCard = (SENTENCE_TOKENS.in * perM.in + SENTENCE_TOKENS.out * perM.out) / 1e6;
      sentencePerCard = perCard === 0 ? null : perCard;
      perKind[kind] = perCard === 0
        ? "$0 — free-tier model"
        : `≈$${usdSmart(perCard)}/card on your ${via} key`;
    } else if (kind === "sentence" && model?.pricing === "$0 (provider free tier)") {
      sentencePerCard = null;
      perKind[kind] = "$0 — free-tier model";
    } else if (kind === "image") {
      perKind[kind] = `billed per image on your ${via} key`;
    } else if (kind === "audio") {
      perKind[kind] = `billed per character on your ${via} key`;
    } else {
      perKind[kind] = `on your ${via} key`;
    }
  }
  const sentenceRuns = sentencePerCard ? runs.filter((r) => r.kinds.includes("sentence")).length : 0;
  return {
    perKind,
    ...(sentencePerCard && sentenceRuns > 0 ? { sentenceTotal: `$${usdSmart(sentencePerCard * sentenceRuns)}` } : {}),
    ...(sentencePerCard === null ? { sentenceTotal: "$0 (free-tier model)" } : {}),
    ...(sentencePerCard !== undefined && kinds.includes("sentence")
      ? { sentenceModel: DEFAULT_MODELS[coverage.sentence.via[0] ?? "openrouter"]?.sentence }
      : {}),
  };
}
