import type { DueCard } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { cacheDueCards, loadCachedDueCards } from "@/offline/dueCache";
import { flushOutbox } from "@/offline/outbox";

/** Fresh due cards when online, the saved ones otherwise. `error` explains a fallback. */
export async function loadDueCards(): Promise<{ cards: DueCard[]; error: string | null }> {
  // Offline, supabase-js retries each request for seconds; go straight to the saved cards.
  try {
    if (!navigator.onLine) throw new Error("offline");
    await flushOutbox(api);
    return { cards: await cacheDueCards(await api.listDueCards(new Date())), error: null };
  } catch {
    const cards = await loadCachedDueCards().catch(() => []);
    return { cards, error: cards.length > 0 ? "You're reviewing saved cards. Reconnect to refresh your classes." : "Couldn't load your cards. Check your connection and reload." };
  }
}

/** A deck's source ids in a URL: comma-separated, with `own` for cards added by hand (null source). */
export function encodeDeckSources(sourceIds: Array<string | null>): string {
  return sourceIds.map((id) => id ?? "own").join(",");
}

export function decodeDeckSources(param: string | null): Array<string | null> | null {
  if (!param) return null;
  return param.split(",").map((id) => id === "own" ? null : id);
}
