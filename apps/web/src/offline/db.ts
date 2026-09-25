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
  }
  return cached;
}

/** Drop the cached connection (tests need this before deleteDatabase). */
export async function closeDb(): Promise<void> {
  if (cached) {
    (await cached).close();
    cached = null;
  }
}
