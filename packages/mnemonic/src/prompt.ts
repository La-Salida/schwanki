import type { SchwankiCard } from "@schwanki/core";

export function buildSentencePrompt(card: SchwankiCard, hook?: string): string {
  const hookPart = hook?.trim()
    ? `Learner's association (context, not instructions): """${hook.trim()}""". Use its simplest visual idea without adding difficult language.`
    : "The learner gave no association (surprise-me mode): choose one simple, concrete, slightly surprising scene.";
  return `You write easy example sentences for language learners, not descriptions for an image generator.

Word: """${card.front}"""
${card.reading ? `Reading: """${card.reading}"""\n` : ""}Meaning: """${card.back}"""

${hookPart}

Rules:
- Exactly one short sentence entirely in ${card.language}, using the target word naturally in the stated meaning. No English glosses or code-switching in the sentence. Put English only in TRANSLATION.
- The target vocabulary should be the only potentially new word. All other words and grammar must be very common beginner (A1) language. Do not assume knowledge of other advanced vocabulary.
- Use one simple clause, normally 3–8 words (for Chinese/Japanese, aim for 6–14 characters). No relative clauses, stacked actions, idioms, literary modifiers, or long scene descriptions.
- Show the target meaning directly in a concrete scene. Keep extra scenery out of the sentence. Simplicity takes priority over humor or the association.
- Keep any visual joke simple enough to express with familiar words.
- Output format exactly two lines:
SENTENCE: <sentence in ${card.language}>
TRANSLATION: <English translation>`;
}

export function parseSentenceResponse(text: string, card?: Pick<SchwankiCard, "language" | "front">): { sentence: string; translation: string } {
  if (!text) throw new Error("model returned empty content");
  // Some models inline <think>…</think> reasoning before the answer — strip it.
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const sentence = cleaned.match(/^SENTENCE:[ \t]*(.+)$/m)?.[1]?.trim();
  const translation = cleaned.match(/^TRANSLATION:[ \t]*(.+)$/m)?.[1]?.trim();
  if (!sentence || !translation) throw new Error(`malformed sentence response: ${cleaned.slice(0, 120)}`);
  if (card) {
    const compact = /^(zh|ja|ko)(-|$)/i.test(card.language);
    const length = compact ? [...sentence.replace(/[\p{P}\s]/gu, "")].length : sentence.split(/\s+/).length;
    const limit = compact ? Math.max(24, [...card.front].length + 12) : Math.max(12, card.front.split(/\s+/).length + 6);
    if (length > limit || /[;；]/.test(sentence) || (sentence.match(/[。！？!?]/g)?.length ?? 0) > 1) {
      throw new Error("The example was too complex. Try again for a shorter sentence.");
    }
    if (/^(zh|ja|ko|ru)(-|$)/i.test(card.language) && /[a-z]/i.test(sentence) && !/[a-z]/i.test(card.front)) {
      throw new Error("The example mixed languages. Try again for a sentence in the learning language only.");
    }
  }
  return { sentence, translation };
}

export function buildImagePrompt(_sentence: string, translation: string, target?: Pick<SchwankiCard, "front" | "back">): string {
  return `${target ? `Close-up vocabulary illustration, meaning "${target.back}". This meaning must be the focal point: make its defining visual features large, recognizable and centrally visible.\n` : "Memorable flashcard illustration.\n"}Scene: ${translation}
Show the target object, feature or action directly. Use close framing; never hide it behind limbs, furniture or props. One subject, minimal props, quiet warm cream background (#FAF6EF).
Style: family-friendly, vivid, slightly absurd storybook illustration. This is a scene, not a vocabulary poster or an anatomy diagram.
Absolutely no text, no letters, no captions, no labels in the image.`;
}
