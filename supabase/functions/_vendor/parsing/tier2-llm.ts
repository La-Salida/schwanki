// GENERATED from packages/parsing/src/tier2-llm.ts — edit the source, then re-run scripts/vendor-edge.sh
import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language.ts";
import { PARSE_PROMPT_V1 } from "./prompts/parse-v1.ts";
import { PARSE_PDF_PROMPT_V2, PDF_PARSE_PROMPT_VERSION } from "./prompts/parse-pdf-v2.ts";
import type { CandidateCard, LlmProvider, SourceMeta } from "./types.ts";

/** Tier 2: LLM structured output for anything Tier 1 can't rule-parse (§6.2). */
export async function parseWithLlm(
  chunk: string,
  meta: SourceMeta,
  llm: LlmProvider,
): Promise<CandidateCard[]> {
  let raw: unknown;
  try {
    raw = await llm.parseCards(meta.type === "pdf_upload" ? PARSE_PDF_PROMPT_V2(meta, chunk) : PARSE_PROMPT_V1(meta, chunk));
  } catch (error) {
    // The PDF import job must retry, rather than recording a failed extraction as done.
    if (meta.type === "pdf_upload") throw error;
    return []; // failure isolation: a dead LLM never kills the sync (§6.3)
  }
  const list = (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(list)) {
    if (meta.type === "pdf_upload") throw new Error("PDF parser returned no vocabulary card list");
    return [];
  }

  const seen = new Set<string>();
  const out: CandidateCard[] = [];
  for (const item of list) {
    const c = item as Record<string, unknown>;
    if (typeof c.front !== "string" || typeof c.back !== "string" || !c.front.trim() || !c.back.trim()) continue;
    if (!validateLanguage(c.front, meta.language)) continue;
    const key = dedupKey(c.front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);
    const confidence = typeof c.confidence === "number" ? Math.min(c.confidence, 0.8) : 0.6;
    out.push({
      front: c.front.trim(),
      back: c.back.trim(),
      ...(typeof c.reading === "string" && c.reading.trim() ? { reading: c.reading.trim() } : {}),
      ...(typeof c.example === "string" && c.example.trim() ? { exampleSentence: c.example.trim() } : {}),
      rawContext: chunk,
      confidence,
      parseNotes: meta.type === "pdf_upload" ? PDF_PARSE_PROMPT_VERSION : "tier2-llm",
    });
  }
  return out;
}
