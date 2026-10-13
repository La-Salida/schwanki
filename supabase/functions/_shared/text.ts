/** Make extracted text safe for Postgres `text` and `jsonb`.
 *  Both reject NUL (\u0000) — jsonb reports it as "unsupported Unicode escape
 *  sequence" — and JSON.stringify writes unpaired surrogates as escapes that
 *  jsonb rejects too. PDFs (notably Thai ones) often carry both. */
export function cleanText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
