import type { SourceType } from "@schwanki/core";

export interface CandidateCard {
  front: string;
  back: string;
  reading?: string;
  exampleSentence?: string;
  /** Exactly what the parser saw — for debugging and user trust (§5). */
  rawContext: string;
  /** 0..1, sorts sketchy parses first in triage (§5). */
  confidence: number;
  parseNotes?: string;
}

export interface SourceMeta {
  type: SourceType;
  language: string; // ISO 639-1
  externalRef?: string;
}

export interface TierResult {
  cards: CandidateCard[];
  /** Raw lines Tier 1 declined; forwarded to Tier 2. */
  unparsed: string[];
}

/** LLM provider abstraction — raw fetch, no SDK, so this package runs in Node AND Deno. */
export interface LlmProvider {
  /** Send a prompt, get back JSON matching the card schema. Implementations must be deterministic-ish (temperature 0). */
  parseCards(prompt: string): Promise<unknown>;
}

/** Orchestrator — implemented in Task 9; signature fixed now. */
export declare function parse(
  rawContent: string,
  meta: SourceMeta,
  llm?: LlmProvider,
): Promise<CandidateCard[]>;
