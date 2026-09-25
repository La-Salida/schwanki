// GENERATED from packages/parsing/src/orchestrator.ts — edit the source, then re-run scripts/vendor-edge.sh
import { dedupKey } from "@schwanki/core";
import { parseDocTable } from "./tier1-doc-table.ts";
import { parseSheet } from "./tier1-sheet.ts";
import { parseWithLlm } from "./tier2-llm.ts";
import type { CandidateCard, LlmProvider, SourceMeta, TierResult } from "./types.ts";

/**
 * Single entry point (§4.2): parse(rawContent, sourceMeta) → CandidateCard[].
 * Tier routing: sheets → table rules; docs → tab rules; everything else → LLM.
 * Tier-1 leftovers escalate to Tier 2 when a provider is available.
 */
export async function parse(
  rawContent: string,
  meta: SourceMeta,
  llm?: LlmProvider,
): Promise<CandidateCard[]> {
  let tier1: TierResult;
  if (meta.type === "google_sheet") tier1 = parseSheet(rawContent, meta);
  else if (meta.type === "google_doc") tier1 = parseDocTable(rawContent, meta);
  else tier1 = { cards: [], unparsed: rawContent.split(/\r?\n/).filter((l) => l.trim()) };

  let tier2Cards: CandidateCard[] = [];
  if (llm && tier1.unparsed.length > 0) {
    tier2Cards = await parseWithLlm(tier1.unparsed.join("\n"), meta, llm);
  }

  // Final cross-tier dedup (§6.3 within-batch layer)
  const seen = new Set(tier1.cards.map((c) => dedupKey(c.front, meta.language)));
  const dedupedTier2 = tier2Cards.filter((c) => {
    const key = dedupKey(c.front, meta.language);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...tier1.cards, ...dedupedTier2];
}
