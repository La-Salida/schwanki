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

const STATUS_CACHE = "schwanki.creditsStatus";

/** The last status this browser loaded. It rarely changes, so screens can show it at once
 *  instead of waiting seconds on a cold edge function, then refresh behind the scenes. */
export function cachedCreditsStatus(): CreditsStatus | null {
  try {
    const raw = localStorage.getItem(STATUS_CACHE);
    return raw ? JSON.parse(raw) as CreditsStatus : null;
  } catch { return null; }
}

export async function loadCreditsStatus(): Promise<CreditsStatus> {
  const { data, error } = await supabase.functions.invoke("credits", { body: { action: "status" } });
  if (error) throw new Error((await errorBody(error)) ?? error.message);
  try { localStorage.setItem(STATUS_CACHE, JSON.stringify(data)); } catch { /* storage full or blocked */ }
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

/** What one credit costs in a pack, in cents: 5, 4, 3.3. One credit makes a card's picture and audio. */
export function perCardCents(pack: CreditPack): string {
  return `${(pack.priceCents / pack.credits).toFixed(1).replace(/\.0$/, "")}¢`;
}

/** Percent saved per credit against the dearest pack, rounded down so it never overclaims. */
export function packSavings(pack: CreditPack, packs: CreditPack[]): number {
  const dearest = Math.max(...packs.map((p) => p.priceCents / p.credits));
  // Rounded to 0.01% first so 1 - 0.8 counts as 20, not 19.999…
  return Math.floor(Math.round((1 - pack.priceCents / pack.credits / dearest) * 10000) / 100);
}
