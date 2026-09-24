import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language";
import type { CandidateCard, SourceMeta, TierResult } from "./types";

/**
 * Tier 1 parser for tab-separated vocab tables inside Google Docs (§6.2).
 * Column order in the real Thai source: word \t pronunciation \t meaning.
 * Non-tabular lines are returned as `unparsed` for Tier 2.
 */
export function parseDocTable(raw: string, meta: SourceMeta): TierResult {
  const cards: CandidateCard[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("\t")) { unparsed.push(trimmed); continue; }

    const cells = trimmed.split("\t").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) { unparsed.push(trimmed); continue; }
    if (/^(thai|word|pronunciation|meaning|pinyin|chinese)$/i.test(cells[0]!)) continue; // header

    const [front, reading, back] = cells as [string, string?, string?];
    const realBack = back ?? reading; // 2-column rows: word \t meaning
    const realReading = back ? reading : undefined;
    if (!front || !realBack) { unparsed.push(trimmed); continue; }
    if (!validateLanguage(front, meta.language)) { unparsed.push(trimmed); continue; }

    const key = dedupKey(front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push({
      front,
      back: realBack,
      ...(realReading ? { reading: realReading } : {}),
      rawContext: trimmed,
      confidence: 0.9,
    });
  }
  return { cards, unparsed };
}
