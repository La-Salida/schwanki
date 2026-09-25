const RANGES: Record<string, RegExp> = {
  zh: /[一-鿿]/,        // CJK unified ideographs
  th: /[ก-๙]/,          // Thai block
  ko: /[가-힯]/,
  ja: /[぀-ヿ一-鿿]/,
  ru: /[Ѐ-ӿ]/,
  ar: /[؀-ۿ]/,
};

/**
 * Guards against cross-language contamination (§6.3): an English gloss must not
 * become a target-language card front. Unknown languages pass through.
 */
export function validateLanguage(front: string, language: string): boolean {
  const range = RANGES[language];
  if (!range) return true;
  return range.test(front);
}
