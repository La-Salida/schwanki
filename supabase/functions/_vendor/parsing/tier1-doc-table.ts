// GENERATED from packages/parsing/src/tier1-doc-table.ts — edit the source, then re-run scripts/vendor-edge.sh
import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language.ts";
import type { CandidateCard, SourceMeta, TierResult } from "./types.ts";

const HEADER_CELL = /^(thai|word|pronunciation|meaning|pinyin|chinese)$/i;

type Role = "front" | "reading" | "back";

function roleOf(headerCell: string): Role {
  if (/^(pronunciation|pinyin)$/i.test(headerCell)) return "reading";
  if (/^meaning$/i.test(headerCell)) return "back";
  return "front"; // thai | word | chinese
}

/**
 * Tier 1 parser for vocab tables inside Google Docs (§6.2).
 *
 * Handles both export layouts of the real Drive text/plain export:
 * - row-per-line: `word \t pronunciation \t meaning` on a single line
 *   (leading TAB indentation is stripped first), and
 * - cell-per-line: every table CELL on its own line (TAB-indented), so a
 *   3-column row is 3 consecutive lines; the table is detected by its
 *   consecutive header cells (Thai/Pronunciation/Meaning/...), which define
 *   the column count and role mapping.
 *
 * A blank line ends a cell-stream table block cleanly; a failed row group
 * (wrong language, numbered prose header like `1. รับผิดชอบ`, empty back)
 * ends it AND sends everything remaining to `unparsed` for Tier 2.
 * Teacher content is never corrected — it passes through verbatim.
 */
export function parseDocTable(raw: string, meta: SourceMeta): TierResult {
  const cards: CandidateCard[] = [];
  const unparsed: string[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\r?\n/);

  const pushCard = (front: string, back: string, reading: string | undefined, rawContext: string) => {
    const key = dedupKey(front, meta.language);
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({
      front,
      back,
      ...(reading ? { reading } : {}),
      rawContext,
      confidence: 0.9,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i]!.trim(); // strips the leading TAB cell indentation
    if (!trimmed) { i++; continue; }

    // Layout 1: internal tabs → one row's cells on a single line.
    if (trimmed.includes("\t")) {
      const cells = trimmed.split("\t").map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) { unparsed.push(trimmed); i++; continue; }
      if (HEADER_CELL.test(cells[0]!)) { i++; continue; } // header row

      const [front, reading, back] = cells as [string, string?, string?];
      const realBack = back ?? reading; // 2-column rows: word \t meaning
      const realReading = back ? reading : undefined;
      if (!front || !realBack) { unparsed.push(trimmed); i++; continue; }
      if (!validateLanguage(front, meta.language)) { unparsed.push(trimmed); i++; continue; }

      pushCard(front, realBack, realReading, trimmed);
      i++;
      continue;
    }

    // Layout 2: cell-per-line. A table starts with ≥2 consecutive header cells.
    if (!HEADER_CELL.test(trimmed)) { unparsed.push(trimmed); i++; continue; }
    const headerCells: string[] = [];
    while (i + headerCells.length < lines.length) {
      const cell = lines[i + headerCells.length]!.trim();
      if (!cell || !HEADER_CELL.test(cell)) break;
      headerCells.push(cell);
    }
    if (headerCells.length < 2) { unparsed.push(trimmed); i++; continue; }

    const roles = headerCells.map(roleOf);
    const width = headerCells.length;
    const frontIdx = roles.indexOf("front");
    const readingIdx = roles.indexOf("reading");
    const backIdx = roles.indexOf("back");
    i += width; // consume the header cells

    // Consume groups of `width` cells as rows.
    while (i < lines.length) {
      if (!lines[i]!.trim()) break; // blank line ends the table block cleanly

      const group: string[] = [];
      let complete = true;
      for (let k = 0; k < width; k++) {
        const cell = lines[i + k]?.trim() ?? "";
        if (!cell) { complete = false; break; }
        group.push(cell);
      }
      if (!complete) break; // ragged tail: blank line ends the block

      const front = group[frontIdx] ?? "";
      const back = backIdx >= 0 ? group[backIdx] : undefined;
      const reading = readingIdx >= 0 ? group[readingIdx] : undefined;

      if (!front || /^\d/.test(front) || !back || !validateLanguage(front, meta.language)) {
        // Failed group: the table is over and nothing after it is trustworthy —
        // everything remaining (including this group's cells) is Tier 2 input.
        for (; i < lines.length; i++) {
          const rest = lines[i]!.trim();
          if (rest) unparsed.push(rest);
        }
        return { cards, unparsed };
      }

      pushCard(front, back, reading, group.join("\t"));
      i += width;
    }
  }

  return { cards, unparsed };
}
