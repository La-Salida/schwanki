// GENERATED from packages/mnemonic/src/credits.ts — edit the source, then re-run scripts/vendor-edge.sh
import type { MediaKind } from "@schwanki/core";
import { SERVER_DEFAULT, type Provider } from "./types.ts";

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

/** Which kinds Schwanki AI (our keys) can serve with automatic model choice. */
export function serverCoverage(hasKey: (provider: Provider) => boolean): Record<MediaKind, boolean> {
  return {
    sentence: hasKey(SERVER_DEFAULT.sentence),
    image: hasKey(SERVER_DEFAULT.image),
    audio: hasKey(SERVER_DEFAULT.audio),
  };
}
