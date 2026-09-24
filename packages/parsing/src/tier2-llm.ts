import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language";
import { PARSE_PROMPT_V1 } from "./prompts/parse-v1";
import type { CandidateCard, LlmProvider, SourceMeta } from "./types";

/** Tier 2: LLM structured output for anything Tier 1 can't rule-parse (§6.2). */
export async function parseWithLlm(
  chunk: string,
  meta: SourceMeta,
  llm: LlmProvider,
): Promise<CandidateCard[]> {
  let raw: unknown;
  try {
    raw = await llm.parseCards(PARSE_PROMPT_V1(meta, chunk));
  } catch {
    return []; // failure isolation: a dead LLM never kills the sync (§6.3)
  }
  const list = (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(list)) return [];

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
      parseNotes: "tier2-llm",
    });
  }
  return out;
}
