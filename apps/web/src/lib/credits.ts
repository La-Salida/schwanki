import type { MediaKind } from "@schwanki/core";
import { CREDIT_PACKS, type CreditPack } from "@schwanki/mnemonic";
import { supabase } from "./supabase";

export interface CreditsStatus {
  purchasesEnabled: boolean;
  /** Kinds Schwanki AI can make right now with automatic model choice. */
  available: Record<MediaKind, boolean>;
  packs: CreditPack[];
}

export const UNKNOWN_STATUS: CreditsStatus = {
  purchasesEnabled: false,
  available: { sentence: false, image: false, audio: false },
  packs: CREDIT_PACKS,
};

async function errorBody(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response }).context;
  const parsed = ctx ? await ctx.json().catch(() => null) as { error?: string } | null : null;
  return parsed?.error ?? null;
}

export async function loadCreditsStatus(): Promise<CreditsStatus> {
  const { data, error } = await supabase.functions.invoke("credits", { body: { action: "status" } });
  if (error) throw new Error((await errorBody(error)) ?? error.message);
  return data as CreditsStatus;
}

/** Returns the Stripe Checkout URL for a pack. */
export async function startCheckout(packId: CreditPack["id"]): Promise<string> {
  const { data, error } = await supabase.functions.invoke("credits", { body: { action: "checkout", packId } });
  if (error) {
    const reason = await errorBody(error);
    if (reason === "payments_not_configured") throw new Error("Buying credits isn't switched on yet.");
    throw new Error(reason ?? error.message);
  }
  return (data as { url: string }).url;
}
