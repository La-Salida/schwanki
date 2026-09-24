import { dedupKey } from "@schwanki/core";
import { parseCsvLine } from "./csv";
import { validateLanguage } from "./language";
import type { CandidateCard, SourceMeta, TierResult } from "./types";

// Latin incl. diacritics (À-ɏ covers pinyin tone marks like ě) adjacent to CJK
const LATIN_IN_CJK = /[一-鿿][a-zA-ZÀ-ɏ]|[a-zA-ZÀ-ɏ][一-鿿]/;

/**
 * Tier 1 deterministic parser for columnar sheets (§6.2).
 * Column order observed in real sources: [date?, word, translation, pinyin?, ...].
 * Normalizes formatting ONLY — teacher content is never corrected (§3).
 */
export function parseSheet(raw: string, meta: SourceMeta): TierResult {
  const cards: CandidateCard[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("#VALUE!")) continue; // spreadsheet error rows

    const cells = parseCsvLine(trimmed).map((c) => c.trim());
    const nonEmpty = cells.filter(Boolean);
    // Lone cells (e.g. ",confidence,,,") are anomalous rows — escalate to Tier 2 (§6.2)
    if (nonEmpty.length < 2) { if (nonEmpty.length === 1) unparsed.push(trimmed); continue; }

    // Header detection: first cell(s) look like English column names
    if (/^(date|word|thai|chinese|pronunciation|meaning|pinyin)/i.test(nonEmpty[0]!)) continue;

    const [front, back, reading] = pickColumns(cells);
    if (!front || !back) { unparsed.push(trimmed); continue; }
    if (!validateLanguage(front, meta.language)) { unparsed.push(trimmed); continue; }

    const key = dedupKey(front, meta.language);
    if (seen.has(key)) continue;
    seen.add(key);

    const fused = meta.language === "zh" && LATIN_IN_CJK.test(front);
    cards.push({
      front,
      back,
      ...(reading ? { reading } : {}),
      rawContext: trimmed,
      confidence: fused ? 0.6 : reading ? 0.95 : 0.85,
      ...(fused ? { parseNotes: "suspicious: latin characters fused into front (fused pinyin?)" } : {}),
    });
  }
  return { cards, unparsed };
}

/** Heuristic column mapping: skip leading date-ish cell, then [front, back, reading]. */
function pickColumns(cells: string[]): [string?, string?, string?] {
  const rest = cells.filter(Boolean);
  // Skip a leading date-ish cell (empty already filtered; match yyyy-mm-dd, dd/mm, etc.)
  const start = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$|^\d{1,2}[-/]\d{1,2}$/.test(rest[0] ?? "") ? 1 : 0;
  return [rest[start], rest[start + 1], rest[start + 2]] as [string?, string?, string?];
}
