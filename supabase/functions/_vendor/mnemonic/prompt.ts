// GENERATED from packages/mnemonic/src/prompt.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { SchwankiCard } from "@schwanki/core";

export function buildSentencePrompt(card: SchwankiCard, hook?: string): string {
  const hookPart = hook?.trim()
    ? `The learner's own association — this is the mnemonic hook and MUST be the core of the scene, quoted verbatim: """${hook.trim()}"""`
    : "The learner gave no association (surprise-me mode): invent a vivid, absurd, concrete scene.";
  return `You write memorable scene sentences for language flashcards.

Word: """${card.front}"""
${card.reading ? `Reading: """${card.reading}"""\n` : ""}Meaning: """${card.back}"""

${hookPart}

Rules:
- Exactly one sentence in ${card.language} using the word naturally.
- The sentence must describe a concrete, visual scene (something an image model can draw).
- Absurd and personal beats generic and correct.
- Output format exactly two lines:
SENTENCE: <sentence in ${card.language}>
TRANSLATION: <English translation>`;
}

export function parseSentenceResponse(text: string): { sentence: string; translation: string } {
  const sentence = text.match(/SENTENCE:\s*(.+)/)?.[1]?.trim();
  const translation = text.match(/TRANSLATION:\s*(.+)/)?.[1]?.trim();
  if (!sentence || !translation) throw new Error(`malformed sentence response: ${text.slice(0, 120)}`);
  return { sentence, translation };
}

export function buildImagePrompt(sentence: string, translation: string): string {
  return `Memorable flashcard illustration of this scene: ${translation}
The scene involves the concept: ${sentence}.
Style: vivid, slightly absurd, storybook illustration, warm cream background (#FAF6EF).
Absolutely no text, no letters, no captions in the image.`;
}
