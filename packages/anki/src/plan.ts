import { newCardState, stateFromHistory, stateFromInterval, type ScheduledState } from "@schwanki/core";
import type { AnkiCard, AnkiCollection } from "./package";

const DAY = 86_400_000;
/** Unseen cards are introduced at Anki's default pace instead of all landing on day one. */
export const NEW_PER_DAY = 20;

export interface PlannedCard { card: AnkiCard; state: ScheduledState }
export interface PlannedDeck { name: string; cards: PlannedCard[]; reviewed: number }
export interface ImportPlan { decks: PlannedDeck[]; suspended: number; skipped: number }

/** Where an Anki card stands in Schwanki: its review history replayed, its interval, or new. */
export function scheduleCard(card: AnkiCard, created: Date, newDueAt: Date): ScheduledState {
  const replayed = stateFromHistory(card.reviews);
  if (replayed) return replayed;
  if (card.type === 2 && card.ivl > 0) {
    // Review cards count their due date in days from the collection's creation.
    const dueAt = new Date(created.getTime() + card.due * DAY);
    return stateFromInterval({
      lastReviewedAt: new Date(dueAt.getTime() - card.ivl * DAY), intervalDays: card.ivl,
      reps: card.reps, lapses: card.lapses, dueAt,
    });
  }
  return newCardState(newDueAt);
}

/** Group a collection into top-level decks with each card's starting schedule. Suspended cards stay behind. */
export function planImport(collection: AnkiCollection, now: Date, newPerDay = NEW_PER_DAY): ImportPlan {
  const active = collection.cards.filter((c) => c.queue !== -1);
  const fresh = active
    .filter((c) => c.reviews.length === 0 && !(c.type === 2 && c.ivl > 0))
    .sort((a, b) => a.due - b.due || a.noteId - b.noteId);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const newDue = new Map(fresh.map((c, i) => {
    const day = Math.floor(i / newPerDay);
    return [c.noteId, day === 0 ? now : new Date(startOfDay.getTime() + day * DAY)];
  }));

  const decks = new Map<string, PlannedDeck>();
  for (const card of active) {
    const name = card.deck.split("::")[0]!.trim() || "Default";
    const deck = decks.get(name) ?? { name, cards: [], reviewed: 0 };
    deck.cards.push({ card, state: scheduleCard(card, collection.created, newDue.get(card.noteId) ?? now) });
    if (!newDue.has(card.noteId)) deck.reviewed++;
    decks.set(name, deck);
  }
  return {
    decks: [...decks.values()].sort((a, b) => b.cards.length - a.cards.length),
    suspended: collection.cards.length - active.length,
    skipped: collection.skipped,
  };
}

const SCRIPTS: Array<[RegExp, string]> = [
  [/[぀-ヿ]/, "ja"], [/[가-힯]/, "ko"], [/[฀-๿]/, "th"],
  [/[一-鿿]/, "zh"], [/[Ѐ-ӿ]/, "ru"], [/[؀-ۿ]/, "ar"], [/[ऀ-ॿ]/, "hi"],
];

/** Guess the deck's language from the script its words are written in; null for Latin-script decks. */
export function guessLanguage(fronts: string[]): string | null {
  const sample = fronts.slice(0, 200).join(" ");
  // Kana marks Japanese even when kanji are more common.
  for (const [pattern, code] of SCRIPTS) if (pattern.test(sample)) return code;
  return null;
}
