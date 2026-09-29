/** Locate the card's target word inside a generated sentence so the UI can highlight it.
 * Exact case-insensitive match wins, extended to Latin/Cyrillic/Greek/number word
 * boundaries so inflected forms light up whole ("invest" → "INVESTING"); CJK matches
 * stay verbatim (words appear unspaced in the sentence). Falls back to a stem-prefix
 * token match for stronger inflections ("investing" still finds "invested"). */
export function wordRange(sentence: string, word: string): [number, number] | null {
  const w = word.trim();
  if (!w) return null;
  const hit = sentence.toLowerCase().indexOf(w.toLowerCase());
  if (hit !== -1) {
    const EXTEND = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]/u;
    let start = hit;
    let end = hit + w.length;
    while (start > 0 && EXTEND.test(sentence[start - 1]!)) start--;
    while (end < sentence.length && EXTEND.test(sentence[end]!)) end++;
    return [start, end];
  }
  const stem = w.toLowerCase().slice(0, Math.max(2, Math.ceil(w.length * 0.6)));
  const tokens = sentence.match(/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]+/gu) ?? [];
  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (tl.length >= 2 && (tl.startsWith(stem) || stem.startsWith(tl))) {
      const i = sentence.indexOf(t);
      if (i !== -1) return [i, i + t.length];
    }
  }
  return null;
}
