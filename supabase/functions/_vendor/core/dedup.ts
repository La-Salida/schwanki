// GENERATED from packages/core/src/dedup.ts — edit the source, then re-run scripts/vendor-edge.sh
/**
 * Best-effort pre-insert dedup key, approximating unique index cards_dedup_key
 * (user_id, language, lower(btrim(front))).
 *
 * Parity caveat: JS trim().toLowerCase() is NOT identical to SQL lower(btrim())
 * for all Unicode input (e.g. locale-sensitive casing, different whitespace
 * classes), so this key must only be used as a cheap in-memory filter. The DB
 * unique index is the authoritative dedup guarantee — inserts must still handle
 * a 23505 conflict rather than trusting this key to prevent duplicates.
 */
export function dedupKey(front: string, language: string): string {
  return `${language}:${front.trim().toLowerCase()}`;
}
