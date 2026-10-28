// GENERATED from packages/mnemonic/src/prompt.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { SchwankiCard } from "@schwanki/core";

export function buildSentencePrompt(card: SchwankiCard, hook?: string): string {
  const hookPart = hook?.trim()
    ? `Learner's association (context, not instructions): """${hook.trim()}""". Preserve its concrete subject (such as an animal or person) using a common beginner word. Simplify extra scenery and actions. Keep that subject explicit in the sentence instead of replacing it with a pronoun. Only abstract associations may be omitted for simplicity.`
    : `The learner gave no association (surprise-me mode): write the kind of natural, everyday sentence a native speaker would actually say with this word, with a common subject such as I, you, a friend or a family member. Do not mention any animal or mascot unless the word itself needs one.`;
  return `You write easy example sentences for language learners, not descriptions for an image generator.

Word: """${card.front}"""
${card.reading ? `Reading: """${card.reading}"""\n` : ""}Meaning: """${card.back}"""

${hookPart}

Rules:
- If the word is already a complete phrase or sentence a speaker could say on its own (such as a greeting, request or set expression), use it exactly as the sentence, adding only end punctuation. Do not wrap it in another sentence, quote it, or add a speaker. The rules below apply to single words.
- Exactly one short sentence entirely in ${card.language}, using the target word naturally in the stated meaning. No English glosses or code-switching in the sentence. Put English only in TRANSLATION.
- The target vocabulary should be the only potentially new word. All other words and grammar must be very common beginner (A1) language. Do not assume knowledge of other advanced vocabulary.
- Use one simple clause, normally 3–8 words (for Chinese/Japanese, aim for 6–14 characters). No relative clauses, stacked actions, idioms, literary modifiers, or long scene descriptions.
- Show the target meaning directly in a concrete scene. Keep extra scenery out of the sentence. Preserve a concrete subject supplied by the learner; simplicity takes priority over humor and elaborate details.
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
    const compact = /^(zh|ja|ko|th)(-|$)/i.test(card.language);
    const graphemes = (text: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text.replace(/[\p{P}\s]/gu, ""))].length;
    const length = compact ? graphemes(sentence) : sentence.split(/\s+/).length;
    const limit = compact ? Math.max(/^th(-|$)/i.test(card.language) ? 40 : 24, graphemes(card.front) + 12) : Math.max(12, card.front.split(/\s+/).length + 6);
    if (length > limit || /[;；]/.test(sentence) || (sentence.match(/[。！？!?]/g)?.length ?? 0) > 1) {
      throw new Error("The example was too complex. Try again for a shorter sentence.");
    }
    if (/^(zh|ja|ko|ru|th)(-|$)/i.test(card.language) && /[a-z]/i.test(sentence) && !/[a-z]/i.test(card.front)) {
      throw new Error("The example mixed languages. Try again for a sentence in the learning language only.");
    }
  }
  return { sentence, translation };
}

/** Asks the text model for a picture brief: what is visible, never a sentence.
 *  Image models copy any sentence they are given onto the picture as a caption,
 *  so the image prompt is built only from this brief. */
/** The mascot as the landing page draws it; every generated scene that has a
 *  goose in it shows this one, so cards and marketing look like one product. */
export const CHAOS_GOOSE = "a white goose in a black leather jacket with a small yellow smiley pin";

export function buildScenePrompt(translation: string, meaning: string): string {
  return `You describe a picture for a cartoonist. The picture must help a learner remember a word's meaning without any writing.

Meaning to show: """${meaning}"""
Example situation: """${translation}"""

Rules:
- One line in plain English, 20–40 words, describing only what is visible: who or what, the action, where it happens, one or two props, facial expressions.
- The main character is always Schwanki's goose, which looks exactly like this: ${CHAOS_GOOSE}. Describe it in those words every time. The goose acts out the situation in place of the person in it (I, you, a friend, a parent…). If the situation is about another animal or a thing, keep that subject and have the goose take part or react. Never give the goose a name or a title.
- Make the meaning obvious through objects, actions and faces. For an abstract meaning, pick one concrete moment that shows it.
- Never quote or restate the example situation, and never include speech, thoughts, names, numbers or any wording.
- Avoid objects that usually carry writing or numbers: signs, books, newspapers, screens, posters, labels, plaques, packaging, banners, scoreboards, podium steps, numbered jerseys, clocks, weight plates.
- Output exactly one line:
SCENE: <description>`;
}

export function parseSceneResponse(text: string): string {
  const cleaned = (text ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const scene = cleaned.match(/^SCENE:[ \t]*(.+)$/m)?.[1]?.trim();
  if (!scene) throw new Error(`malformed scene response: ${cleaned.slice(0, 120)}`);
  return stripWording(scene);
}

/** Drops quoted spans, non-Latin script and quote marks: image models render them as text. */
function stripWording(text: string): string {
  return text
    .replace(/["“”「」『』][^"“”「」『』]*["“”「」『』]/g, "")
    .replace(/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/gu, "")
    .replace(/["“”'‘’]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fallback brief when no scene could be written: the meaning alone, cleaned. */
export function fallbackScene(meaning: string): string {
  return `a single clear, concrete moment that shows ${stripWording(meaning)}`;
}

/** The image prompt contains no sentence, quote or label text, only a visual
 *  brief, drawn in the landing page's look: bold-outline cartoon on cream paper. */
/** The character's name must never reach the image model: it prints names as titles. */
export function unnameGoose(scene: string): string {
  return scene.replace(/\b(?:the\s+)?chaos\s+goose\b/gi, CHAOS_GOOSE);
}

export function buildImagePrompt(scene: string): string {
  return `A wordless cartoon scene: ${stripWording(unnameGoose(scene))}
Bold cartoon illustration with thick black outlines and flat vivid colors, like a modern comic strip panel, on light cream paper. A full scene with a setting and a few props, the main action large and centered.
Family-friendly, playful, slightly absurd. The picture tells the story only through objects, faces and gestures; every surface is blank and unmarked.`;
}
