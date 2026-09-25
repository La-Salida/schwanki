import { openDB, type IDBPDatabase } from "idb";

let cached: Promise<IDBPDatabase> | null = null;

export function db(): Promise<IDBPDatabase> {
  if (!cached) {
    cached = openDB("schwanki-offline", 1, {
      upgrade(d) {
        d.createObjectStore("due", { keyPath: "card.id" });
        d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      },
    });
    // If openDB rejects, drop the cache so the next call retries instead of
    // returning the same rejected promise forever.
    cached.catch(() => { cached = null; });
  }
  return cached;
}

/** Drop the cached connection (tests need this before deleteDatabase). */
export async function closeDb(): Promise<void> {
  const c = cached;
  cached = null;
  if (c) {
    try {
      (await c).close();
    } catch {
      // open failed; nothing to close
    }
  }
}
