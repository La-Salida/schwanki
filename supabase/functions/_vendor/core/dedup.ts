// GENERATED from packages/core/src/dedup.ts — edit the source, then re-run scripts/vendor-edge.sh
/** Single source of truth for the dedup key; mirrors unique index cards_dedup_key. */
export function dedupKey(front: string, language: string): string {
  return `${language}:${front.trim().toLowerCase()}`;
}
