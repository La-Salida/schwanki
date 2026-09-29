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

/** Grammar-abbreviation noise that shows up in card fronts but never in sentences. */
const STOP = new Set(["vs", "and", "or", "adj", "adv", "aux", "cl", "lit", "neg"]);

/** Split a card front into highlightable terms. Fronts may be single words (投资),
 *  contrast pairs (计划vs打算), or structure patterns (A没有B这么adj.) whose
 *  single-letter placeholders (A, B) and abbreviations (adj.) never appear in the
 *  sentence — so we keep CJK runs and latin runs of 2+ chars, minus the stop list. */
export function frontTerms(front: string): string[] {
  const runs = front.match(/[\p{Script=Han}]+|[A-Za-z]{2,}/gu) ?? [];
  const seen = new Set<string>();
  return runs.filter((r) => {
    const key = r.toLowerCase();
    if (STOP.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** All places in the sentence where any term of the front is used, merged and sorted. */
export function frontRanges(sentence: string, front: string): Array<[number, number]> {
  const ranges = frontTerms(front)
    .map((t) => wordRange(sentence, t))
    .filter((r): r is [number, number] => r !== null)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}
