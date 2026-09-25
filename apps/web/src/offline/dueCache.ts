import type { DueCard } from "@schwanki/core";
import { db } from "./db";

export async function cacheDueCards(cards: DueCard[]): Promise<void> {
  const d = await db();
  const tx = d.transaction("due", "readwrite");
  await tx.store.clear();
  for (const c of cards) await tx.store.put(c);
  await tx.done;
}

export async function loadCachedDueCards(): Promise<DueCard[]> {
  return (await (await db()).getAll("due")) as DueCard[];
}
