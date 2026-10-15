import type { MediaKind } from "@schwanki/core";
import { CAPABILITY, type Provider } from "./types.ts";

/** A credit pack sold through Stripe Checkout. Price is in US cents. */
export interface CreditPack {
  id: "starter" | "plus" | "pro";
  credits: number;
  priceCents: number;
  label: string;
}

/** 1 credit = one picture + audio scene for a card (see pricing.ts runCost). */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", credits: 100, priceCents: 500, label: "Starter" },
  { id: "plus", credits: 500, priceCents: 2000, label: "Plus" },
  { id: "pro", credits: 1500, priceCents: 5000, label: "Pro" },
];

export function findCreditPack(id: unknown): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Which kinds Schwanki AI (our keys) can serve with automatic model choice:
 *  the credit path falls back to each kind's first capable provider. */
export function serverCoverage(hasKey: (provider: Provider) => boolean): Record<MediaKind, boolean> {
  return {
    sentence: hasKey(CAPABILITY.sentence[0]!),
    image: hasKey(CAPABILITY.image[0]!),
    audio: hasKey(CAPABILITY.audio[0]!),
  };
}
