// GENERATED from packages/core/src/readings.ts — edit the source, then re-run scripts/vendor-edge.sh
/** How a language's pronunciation is written for learners. Languages missing here
 *  are read as written (Spanish, Vietnamese…) and get no reading. */
export const READING_STYLES: Record<string, string> = {
  zh: "pinyin with tone marks (e.g. míng xiǎn)",
  ja: "the kana reading, then romaji in parentheses (e.g. たべる (taberu))",
  ko: "Revised Romanization (e.g. gamsahamnida)",
  th: "a common romanization with tone marks (e.g. sa-wàt-dii)",
  ru: "a Latin transliteration with the stressed vowel marked (e.g. spasíba)",
  ar: "a Latin transliteration with vowels written out (e.g. shukran)",
  hi: "a Latin transliteration with long vowels marked (e.g. dhanyavād)",
};

/** True for languages whose script a learner can't sound out without help. */
export function needsReading(language: string): boolean {
  return language.toLowerCase() in READING_STYLES;
}
