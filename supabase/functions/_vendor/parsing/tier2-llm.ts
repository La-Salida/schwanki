// GENERATED from packages/parsing/src/tier2-llm.ts — edit the source, then re-run scripts/vendor-edge.sh
import { dedupKey } from "@schwanki/core";
import { validateLanguage } from "./language.ts";
import { PARSE_PROMPT_V1 } from "./prompts/parse-v1.ts";
import { PARSE_PDF_PROMPT_V2, PDF_PARSE_PROMPT_VERSION } from "./prompts/parse-pdf-v2.ts";
import { PARSE_LESSON_PROMPT_V1, LESSON_PARSE_PROMPT_VERSION } from "./prompts/parse-lesson-v1.ts";
import { ParseTruncatedError } from "./openai-compatible.ts";
import type { CandidateCard, LlmProvider, SourceMeta } from "./types.ts";

/** Lesson PDFs are dense: one card can come from every line, so keep each request small. */
export const PDF_CHUNK_LINES = 20;
const MIN_SPLIT_LINES = 4;
/** A lesson transcript has one line per utterance; most lines hold no card, so pieces can be larger. */
export const LESSON_CHUNK_LINES = 80;

function promptFor(meta: SourceMeta, piece: string): string {
  if (meta.type === "pdf_upload") return PARSE_PDF_PROMPT_V2(meta, piece);
  if (meta.type === "class_recording") return PARSE_LESSON_PROMPT_V1(meta, piece);
  return PARSE_PROMPT_V1(meta, piece);
}

/** Imports the user is waiting on (a PDF, a recorded lesson) retry instead of finishing empty. */
function strict(meta: SourceMeta): boolean {
  return meta.type === "pdf_upload" || meta.type === "class_recording";
}

/** Split text into pieces of at most `size` lines. */
export function splitLines(text: string, size: number): string[] {
  const lines = text.split(/\r?\n/);
  const pieces: string[] = [];
  for (let i = 0; i < lines.length; i += size) pieces.push(lines.slice(i, i + size).join("\n"));
  return pieces.filter((piece) => piece.trim());
}

/** Ask the model for one piece; when it runs out of output room, halve the piece and try again. */
async function requestCards(piece: string, meta: SourceMeta, llm: LlmProvider): Promise<Array<{ raw: unknown; chunk: string }>> {
  try {
    return [{ raw: await llm.parseCards(promptFor(meta, piece)), chunk: piece }];
  } catch (error) {
    const lines = piece.split(/\r?\n/);
    if (!(error instanceof ParseTruncatedError) || lines.length < MIN_SPLIT_LINES * 2) throw error;
    const half = Math.ceil(lines.length / 2);
    return [
      ...await requestCards(lines.slice(0, half).join("\n"), meta, llm),
      ...await requestCards(lines.slice(half).join("\n"), meta, llm),
    ];
  }
}

/** Tier 2: LLM structured output for anything Tier 1 can't rule-parse (§6.2). */
export async function parseWithLlm(
  chunk: string,
  meta: SourceMeta,
  llm: LlmProvider,
): Promise<CandidateCard[]> {
  const pieces = meta.type === "pdf_upload" ? splitLines(chunk, PDF_CHUNK_LINES)
    : meta.type === "class_recording" ? splitLines(chunk, LESSON_CHUNK_LINES) : [chunk];
  let responses: Array<{ raw: unknown; chunk: string }>;
  try {
    responses = (await Promise.all(pieces.map((piece) => requestCards(piece, meta, llm)))).flat();
  } catch (error) {
    // The PDF or lesson import job must retry, rather than recording a failed extraction as done.
    if (strict(meta)) throw error;
    return []; // failure isolation: a dead LLM never kills the sync (§6.3)
  }
  const list: Array<{ item: unknown; chunk: string }> = [];
  for (const { raw, chunk: piece } of responses) {
    const cards = (raw as { cards?: unknown })?.cards;
    if (!Array.isArray(cards)) {
      if (strict(meta)) throw new Error("Parser returned no vocabulary card list");
      return [];
    }
    list.push(...cards.map((item) => ({ item, chunk: piece })));
  }

  const seen = new Set<string>();
  const out: CandidateCard[] = [];
  for (const { item, chunk: piece } of list) {
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
      rawContext: piece,
      confidence,
      parseNotes: meta.type === "pdf_upload" ? PDF_PARSE_PROMPT_VERSION
        : meta.type === "class_recording" ? LESSON_PARSE_PROMPT_VERSION : "tier2-llm",
    });
  }
  return out;
}
