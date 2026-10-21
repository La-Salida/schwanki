import { api } from "@/lib/supabase";
import { db } from "./db";
import { flushOutbox } from "./outbox";

/** Save queued reviews before leaving this account; never discard unsynced ratings. */
export async function prepareSignOut(): Promise<void> {
  await flushOutbox(api);
  const database = await db();
  if (await database.count("outbox")) {
    throw new Error("Your offline reviews haven't synced yet. Connect to the internet and try logging out again.");
  }
}

/** Keep offline cards intact if authentication logout fails. */
export async function clearDueCache(): Promise<void> {
  await (await db()).clear("due");
}
