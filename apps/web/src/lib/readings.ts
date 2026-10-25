import { needsReading, type DueCard } from "@schwanki/core";
import { supabase } from "@/lib/supabase";

/** One request's worth; matches the edge function's MAX_CARDS. */
const BATCH = 60;
/** Cards asked about in this page load. A card the model skipped is not asked again
 *  until the page reloads, so a stubborn word doesn't cost a request per review. */
const asked = new Set<string>();

export function missingReadings(cards: DueCard[]): DueCard[] {
  return cards.filter((d) => !d.card.reading?.trim() && needsReading(d.card.language) && !asked.has(d.card.id));
}

/** Pronunciations for cards that lack one, in the languages learners can't sound out
 *  (pinyin for Chinese, kana + romaji for Japanese, …). Returns what the server filled,
 *  keyed by card id; empty on any failure so the review goes on without readings. */
export async function fillMissingReadings(cards: DueCard[]): Promise<Record<string, string>> {
  const wanted = missingReadings(cards);
  if (wanted.length === 0 || !navigator.onLine) return {};
  const batch = wanted.slice(0, BATCH);
  batch.forEach((d) => asked.add(d.card.id));
  try {
    const { data, error } = await supabase.functions.invoke("add-readings", { body: { cardIds: batch.map((d) => d.card.id) } });
    if (error) return {};
    const readings = (data as { readings?: unknown })?.readings;
    if (!readings || typeof readings !== "object") return {};
    return Object.fromEntries(Object.entries(readings as Record<string, unknown>).filter(([, v]) => typeof v === "string" && v.trim())) as Record<string, string>;
  } catch {
    return {};
  }
}

export function withReadings(cards: DueCard[], readings: Record<string, string>): DueCard[] {
  return cards.map((d) => {
    const reading = readings[d.card.id];
    return reading ? { ...d, card: { ...d.card, reading } } : d;
  });
}

/** Test hook. */
export function resetReadingRequests() { asked.clear(); }
