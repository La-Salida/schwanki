import { useState } from "react";
import { CREDIT_PACKS, STARTER_CREDITS, formatPrice } from "@schwanki/mnemonic";
import { signInWithGoogle } from "@/lib/auth";
import { perCardCents } from "@/lib/credits";
import { pricingFaq } from "@/lib/pricingFaq";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";
import { CreditPacks } from "@/components/CreditPacks";
import GoogleButton from "@/components/GoogleButton";
import { LegalLinks } from "@/components/LegalLinks";

const cheapest = CREDIT_PACKS.reduce((a, b) => (b.priceCents / b.credits < a.priceCents / a.credits ? b : a));

const COSTS: Array<[string, string]> = [
  ["Reviewing, Anki imports, scheduling", "Free"],
  ["Reading class notes into cards", "Free for 10 documents a day, then 1 credit each"],
  ["Example sentence", "Free for 50 a day, then 1 credit each"],
  ["Reading a class picture", "1 credit"],
  ["AI suggestion for a meaning or pronunciation", "1 credit"],
  ["Picture for a card", "1 credit"],
  ["Pronunciation audio", "1 credit"],
  ["Picture and audio together", "1 credit"],
];


/** Public pricing. Signed-in visitors buy from Billing; everyone else starts with Google. */
export default function Pricing({ signedIn }: { signedIn: boolean }) {
  usePageMeta(PAGES.pricing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (signedIn) { window.location.assign("/"); return; }
    setBusy(true); setError(null);
    try { await signInWithGoogle(); }
    catch (failure) { setError(`Couldn't sign in: ${(failure as Error).message}. Try again.`); setBusy(false); }
  }
  const startButton = (className: string) => signedIn
    ? <button type="button" onClick={() => void start()} className={className}>Open Schwanki</button>
    : <GoogleButton theme="light" onClick={() => void start()} disabled={busy} />;

  return (
    <main id="main-content" className="landing pricing">
      <header className="pricing-nav">
        <a href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight" aria-label="Schwanki home"><img src="/goose.png" alt="" className="h-9 w-9" />Schwanki</a>
        <nav aria-label="Pricing navigation"><a href="/">Home</a><a href="#packs">Credit packs</a>{signedIn ? <a href="/">Open app</a> : <button type="button" onClick={() => void start()} disabled={busy}>Sign in</button>}</nav>
      </header>

      <section className="pricing-hero" aria-labelledby="pricing-heading">
        <div>
          <h1 id="pricing-heading">The flashcard app is free. <span className="margin-underline">Pictures</span> cost credits.</h1>
          <p className="pricing-lede">Reviewing, importing, scheduling and example sentences cost nothing. A credit buys a picture and pronunciation audio for one card, from {perCardCents(cheapest)} a card. No subscription, and credits don't expire.</p>
          <div className="pricing-hero-actions">{startButton("primary-button landing-cta")}<a href="#packs" className="landing-text-link">See credit packs</a></div>
          <p className="pricing-hero-note">{STARTER_CREDITS} credits free when you sign up. No card needed.</p>
          {error && <p role="alert" className="error-notice">{error}</p>}
        </div>
        <div className="pricing-hero-art" aria-hidden="true"><div className="pricing-slab index-card" /><img src="/goose.png" alt="" /></div>
      </section>

      <section className="pricing-free" aria-labelledby="free-heading">
        <h2 id="free-heading">Free, for good</h2>
        <ul>
          <li>Unlimited decks and reviews</li>
          <li>Anki import with your review history</li>
          <li>FSRS scheduling in a swipe feed</li>
          <li>Class notes turned into Inbox words</li>
          <li>Example sentences</li>
          <li>{STARTER_CREDITS} credits to try pictures and audio</li>
        </ul>
      </section>

      <section id="packs" className="pricing-packs" aria-labelledby="packs-heading">
        <div className="pricing-section-head">
          <h2 id="packs-heading">Credit packs</h2>
          <p>One-time payments. Bigger packs cost less per card, and you spend credits only on the cards you pick.</p>
        </div>
        <CreditPacks packs={CREDIT_PACKS} action={(pack) => signedIn
          ? <a href="/billing#credit-packs" className="secondary-button">Buy {pack.label} · {formatPrice(pack.priceCents)}</a>
          : <button type="button" onClick={() => void start()} disabled={busy} className="secondary-button">Sign in to buy</button>} />
        <p className="pricing-fineprint">Prices in USD. Checkout by Stripe. {signedIn ? "Packs open in Billing, where your receipts live." : "Your free credits arrive when you sign in, before you spend anything."}</p>
        <p className="pricing-keys"><strong>Have your own OpenAI, Anthropic, ElevenLabs or fal key?</strong> Add it in Settings and use it instead. Your provider bills you directly, we add nothing, and no credits go on what your keys cover. We're not animals.</p>
      </section>

      <section className="pricing-costs" aria-labelledby="costs-heading">
        <div className="pricing-section-head">
          <h2 id="costs-heading">What a credit buys</h2>
          <p>A credit pays for the picture and the pronunciation audio on one card. Make both together and it's still one credit.</p>
        </div>
        <dl className="cost-table">{COSTS.map(([what, cost]) => <div key={what}><dt>{what}</dt><dd className={cost === "Free" ? "cost-free" : undefined}>{cost}</dd></div>)}</dl>
      </section>

      <section className="landing-faq" aria-labelledby="pricing-faq-heading"><h2 id="pricing-faq-heading">Money questions,<br />straight answers.</h2><div>
        {pricingFaq(STARTER_CREDITS).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div></section>

      <section className="landing-closer"><img src="/goose.png" alt="The Chaos Goose" className="w-24 shrink-0 sm:w-32" /><div><h2>Start with your Anki deck.<br />Buy credits when a word needs a picture.</h2>{startButton("primary-button")}</div></section>
      <footer className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-ink/70"><span>Schwanki · a modern take on Anki</span><LegalLinks /></footer>
    </main>
  );
}
