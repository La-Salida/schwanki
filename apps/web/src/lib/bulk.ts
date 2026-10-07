import type { MediaKind } from "@schwanki/core";
import { CREDIT_COST, DEFAULT_MODELS, TYPICAL_UNIT_COST, capabilityCoverage, type ModelOption, type Provider } from "@schwanki/mnemonic";
import { supabase } from "./supabase";

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
/** Target-language sentences are short — assume ~40 spoken chars for audio estimates. */
const CHARS_PER_SENTENCE = 40;

const usdSmart = (n: number): string =>
  n >= 0.01 ? n.toFixed(2) : n >= 0.001 ? n.toFixed(3) : n.toFixed(4);

export interface ProviderCost {
  /** Per-kind checkbox hint: which key serves it + $ when computable, or the credit price. */
  perKind: Partial<Record<MediaKind, string>>;
  /** Ready-made estimate-box lines for each requested kind (with $ where known). */
  lines: Array<{ kind: MediaKind; text: string }>;
}

export type CatalogMap = Partial<Record<Provider, Partial<Record<MediaKind, ModelOption[]>>>>;

/** Provider-side cost for BYOK kinds: live $ where the catalog prices the smart-pick
 *  model (OpenRouter per-token rates), typical-rate $ from public rate cards for the
 *  default image/audio models (labeled ≈), and honest "on your key" only when even
 *  that is unknown (fish, higgsfield). Never an invented number. */
export function providerCost(
  runs: Array<{ kinds: MediaKind[] }>,
  kinds: MediaKind[],
  savedProviders: Provider[],
  catalog: CatalogMap,
): ProviderCost {
  const coverage = capabilityCoverage(savedProviders);
  const perKind: Partial<Record<MediaKind, string>> = {};
  const lines: Array<{ kind: MediaKind; text: string }> = [];
  let sentencePerCard: number | null | undefined; // undefined=unknown, null=free tier
  const countRuns = (k: MediaKind) => runs.filter((r) => r.kinds.includes(k)).length;
  for (const kind of kinds) {
    const via = coverage[kind].via[0];
    if (!via) {
      perKind[kind] = "1 credit";
      lines.push({ kind, text: `${kind} → 1 Schwanki credit each` });
      continue;
    }
    const modelId = DEFAULT_MODELS[via]?.[kind];
    const model = modelId ? catalog[via]?.[kind]?.find((m) => m.id === modelId) : undefined;
    const perM = model?.pricingPerM;
    if (kind === "sentence") {
      if (perM) {
        const perCard = (SENTENCE_TOKENS.in * perM.in + SENTENCE_TOKENS.out * perM.out) / 1e6;
        sentencePerCard = perCard === 0 ? null : perCard;
        perKind[kind] = perCard === 0
          ? "$0 (free-tier model)"
          : `≈$${usdSmart(perCard)}/card on your ${via} key`;
      } else if (model?.pricing === "$0 (provider free tier)") {
        sentencePerCard = null;
        perKind[kind] = "$0 (free-tier model)";
      } else {
        perKind[kind] = `on your ${via} key`;
      }
      lines.push({
        kind,
        text: sentencePerCard === null
          ? "sentences $0 (free-tier model)"
          : sentencePerCard
            ? `sentences ≈ $${usdSmart(sentencePerCard * countRuns(kind))} total${modelId ? ` (${modelId} at live rates)` : ""}`
            : `sentences on your ${via} key`,
      });
    } else if (kind === "image") {
      const unit = modelId ? TYPICAL_UNIT_COST[modelId] : undefined;
      perKind[kind] = unit
        ? `≈$${usdSmart(unit)}/image on your ${via} key`
        : `billed per image on your ${via} key`;
      lines.push({
        kind,
        text: unit
          ? `images ≈ $${usdSmart(unit * countRuns(kind))} total${modelId ? ` (${modelId})` : ""}`
          : `images billed per image on your ${via} key`,
      });
    } else {
      const perChar = modelId ? TYPICAL_UNIT_COST[modelId] : undefined;
      perKind[kind] = perChar
        ? `≈$${usdSmart(perChar * CHARS_PER_SENTENCE)}/card on your ${via} key`
        : `billed per character on your ${via} key`;
      lines.push({
        kind,
        text: perChar
          ? `audio ≈ $${usdSmart(perChar * CHARS_PER_SENTENCE * countRuns(kind))} total${modelId ? ` (${modelId}, ~${CHARS_PER_SENTENCE} chars each)` : ""}`
          : `audio billed per character on your ${via} key`,
      });
    }
  }
  return { perKind, lines };
}

/** Split into PostgREST-sized insert chunks (URL/body limits). */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Enqueue a deck run server-side — the cron'd bulk-worker drains it; the tab
 *  can close. Returns the number of jobs enqueued (0 on failure). */
export async function enqueueBulk(runs: Array<{ cardId: string; kinds: MediaKind[] }>): Promise<number> {
  let enqueued = 0;
  for (const batch of chunk(runs)) {
    const { error } = await supabase.from("bulk_jobs").insert(
      batch.map((r) => ({ card_id: r.cardId, kinds: r.kinds })),
    );
    if (error) return enqueued;
    enqueued += batch.length;
  }
  return enqueued;
}

export interface BulkJobRow { status: string; error: string | null }
export interface BulkProgress { done: number; failed: number; queued: number; active: number }

export function summarizeJobs(rows: BulkJobRow[]): BulkProgress {
  const p = { done: 0, failed: 0, queued: 0, active: 0 };
  for (const r of rows) {
    if (r.status === "done") p.done++;
    else if (r.status === "failed") p.failed++;
    else if (r.status === "running") p.active++;
    else p.queued++;
  }
  return p;
}

/** Poll the user's queue (RLS-scoped). Null when no jobs exist; otherwise the
 *  totals — the banner reads queued+active>0 as running, else as the finished
 *  summary it shows once then dismisses. */
export async function pollBulk(): Promise<BulkProgress | null> {
  const { data } = await supabase.from("bulk_jobs").select("status, error");
  if (!data || data.length === 0) return null;
  return summarizeJobs(data as BulkJobRow[]);
}

/** Cancel: delete the caller's still-pending jobs (RLS enforces ownership). */
export async function cancelBulk(): Promise<void> {
  await supabase.from("bulk_jobs").delete().eq("status", "pending");
}
