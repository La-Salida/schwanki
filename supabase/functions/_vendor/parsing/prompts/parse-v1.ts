// GENERATED from packages/parsing/src/prompts/parse-v1.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { SourceMeta } from "../types.ts";

/**
 * Prompt v1 (2026-09-24). Versioned like code (§4.2): bump the filename on any change.
 * Rules baked in from spec §6.3: never correct teacher content; preserve the teacher's
 * own romanization; extract example sentences when present (§7.1 teacher examples first).
 */
export const PARSE_PROMPT_VERSION = "parse-v1";

export function PARSE_PROMPT_V1(meta: SourceMeta, chunk: string): string {
  return `You extract vocabulary flashcards from a language teacher's raw lesson notes.

Source language: ${meta.language}. The student's native language is English.

Rules:
- Output ONLY via the emit_cards tool.
- front = the word/phrase in ${meta.language} script, exactly as written (never fix typos).
- back = the English meaning, exactly as written (never fix typos like "arrrive").
- reading = pronunciation/romanization/pinyin if present, in the teacher's own notation.
- example = an example sentence from the notes if one exists, format "sentence — translation". Omit otherwise.
- confidence = 0.8 if the entry is unambiguous, lower if you guessed.
- Skip headers, dates, and section titles. Skip anything that is not vocabulary.

NOTES:
"""
${chunk}
"""`;
}
