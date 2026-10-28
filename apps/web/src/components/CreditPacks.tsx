import type { ReactNode } from "react";
import { formatPrice, type CreditPack } from "@schwanki/mnemonic";
import { packSavings, perCardCents } from "@/lib/credits";

const TAGLINE: Record<CreditPack["id"], string> = {
  starter: "For the words that won't stick",
  plus: "A deck's worth of scenes",
  pro: "Your whole vocabulary, illustrated",
};
const BADGE: Partial<Record<CreditPack["id"], string>> = { plus: "Sweet spot", pro: "Best value" };

/** The three credit packs as cards: price per card, savings, and a pile that grows with the pack.
 *  The pricing page, Billing and Settings share it and each supply their own action. */
export function CreditPacks({ packs, action }: { packs: CreditPack[]; action: (pack: CreditPack) => ReactNode }) {
  return <ul className="pack-grid">{packs.map((pack, i) => {
    const savings = packSavings(pack, packs);
    const badge = BADGE[pack.id];
    return <li key={pack.id} className={`pack-card${pack.id === "plus" ? " pack-card-featured" : ""}`}>
      {badge && <p className="pack-badge">{badge}</p>}
      <div className="pack-pile" aria-hidden="true">{Array.from({ length: i + 1 }, (_, n) => <span key={n} />)}</div>
      <h3 className="pack-name">{pack.label}</h3>
      <p className="pack-tagline">{TAGLINE[pack.id]}</p>
      <p className="pack-count">{pack.credits.toLocaleString("en-US")} <span>credits</span></p>
      <p className="pack-price"><strong>{formatPrice(pack.priceCents)}</strong> one time</p>
      <p className="pack-unit">{perCardCents(pack)} a card{savings > 0 && <span className="pack-save">Save {savings}%</span>}</p>
      <div className="pack-action">{action(pack)}</div>
    </li>;
  })}</ul>;
}

/** What a balance buys, in cards. One credit is one card's picture and audio. */
export function BalanceMeaning({ balance }: { balance: number | null }) {
  if (balance === null) return null;
  if (balance === 0) return <p className="credit-empty-line">You're out of credits. The goose suggests a refill. It's not asking.</p>;
  return <p className="credit-hero-meaning">Enough for {balance.toLocaleString()} {balance === 1 ? "card" : "cards"} with a picture and audio.</p>;
}

/** The price list in one line of chips. Mirrors CREDIT_COST and runCost in @schwanki/mnemonic. */
export function CreditRates() {
  return <ul className="credit-rates" aria-label="What credits buy">
    <li>Example sentence <strong>free</strong></li>
    <li>Picture <strong>1 credit</strong></li>
    <li>Audio <strong>1 credit</strong></li>
    <li>Picture + audio <strong>1 credit</strong></li>
  </ul>;
}
