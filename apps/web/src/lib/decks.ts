import type { DueCard, ReviewGroup, Source } from "@schwanki/core";
import { classPdfTeacher } from "@/lib/classPdf";
import { encodeDeckSources } from "@/lib/dueCards";

/** A deck is one teacher's cards in one language, across every class source. */
export interface Deck { key: string; teacher: string; language: string; sourceIds: Array<string | null>; due: number; fresh: number; total: number; warned: boolean }

export function buildDecks(groups: ReviewGroup[], sources: Source[]): Deck[] {
  const decks = new Map<string, Deck>();
  for (const g of groups) {
    const source = sources.find((s) => s.id === g.sourceId);
    const teacher = g.sourceId === null ? "Your own cards" : source ? classPdfTeacher(source.label) : "Removed class notes";
    const key = `${teacher.toLowerCase()}|${g.language}`;
    const deck = decks.get(key) ?? { key, teacher, language: g.language, sourceIds: [], due: 0, fresh: 0, total: 0, warned: false };
    deck.sourceIds.push(g.sourceId);
    deck.due += g.due; deck.fresh += g.fresh; deck.total += g.total;
    deck.warned ||= source?.status === "error" || source?.status === "revoked";
    decks.set(key, deck);
  }
  return [...decks.values()].sort((a, b) => b.due - a.due || a.teacher.localeCompare(b.teacher));
}

/** Offline stand-in for api.reviewGroups(): counts from the saved due cards only. */
export function groupsFromDue(due: DueCard[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const d of due) {
    const key = d.card.sourceId ?? "";
    const g = groups.get(key) ?? { sourceId: d.card.sourceId, language: d.card.language, total: 0, due: 0, fresh: 0 };
    g.total++;
    g.due++;
    if (d.state === null) g.fresh++;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** The review page for everything due, or for one deck. */
export function reviewPath(sourceIds: Array<string | null> | null, label?: string): string {
  if (sourceIds === null) return "/review";
  return `/review?${new URLSearchParams({ sources: encodeDeckSources(sourceIds), ...(label ? { label } : {}) })}`;
}
