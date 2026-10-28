import { useState } from "react";
import { CREDIT_PACKS, STARTER_CREDITS, formatPrice } from "@schwanki/mnemonic";
import { signInWithGoogle } from "@/lib/auth";
import { perCardCents } from "@/lib/credits";
import { pricingFaq } from "@/lib/pricingFaq";
import { PAGES } from "@/lib/seo";
import { usePageMeta } from "@/lib/usePageMeta";
import { CreditPacks } from "@/components/CreditPacks";
import { LegalLinks } from "@/components/LegalLinks";

const cheapest = CREDIT_PACKS.reduce((a, b) => (b.priceCents / b.credits < a.priceCents / a.credits ? b : a));

const COSTS: Array<[string, string]> = [
  ["Reviewing, importing, scheduling", "Free"],
  ["Example sentence", "Free"],
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
  const startLabel = signedIn ? "Open Schwanki" : busy ? "Opening Google…" : "Start free with Google";
  const startButton = (className: string) => <button type="button" onClick={() => void start()} disabled={busy} className={className}>{startLabel}</button>;

  return (
    <main id="main-content" className="landing pricing">
      <header className="pricing-nav">
        <a href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight" aria-label="Schwanki home"><img src="/goose.png" alt="" className="h-9 w-9" />Schwanki</a>
        <nav aria-label="Pricing navigation"><a href="/">Home</a><a href="#packs">Credit packs</a>{signedIn ? <a href="/">Open app ↗</a> : <button type="button" onClick={() => void start()} disabled={busy}>Sign in ↗</button>}</nav>
      </header>

      <section className="pricing-hero" aria-labelledby="pricing-heading">
        <div>
          <p className="landing-eyebrow">Pricing</p>
          <h1 id="pricing-heading">Free gets you the deck. Credits get you the <mark className="landing-mark">cinema</mark>.</h1>
          <p className="pricing-lede">Reviewing, importing and scheduling cost nothing. Pay only when you want a word turned into a picture and a voice, from {perCardCents(cheapest)} a card. No subscription.</p>
          <div className="pricing-hero-actions">{startButton("primary-button landing-cta")}<a href="#packs" className="landing-text-link">See credit packs</a></div>
          <p className="pricing-hero-note">{STARTER_CREDITS} free AI credits when you sign up · No card needed</p>
          {error && <p role="alert" className="error-notice">{error}</p>}
        </div>
        <div className="pricing-hero-art" aria-hidden="true"><div className="pricing-slab" /><img src="/goose.png" alt="" /></div>
      </section>

      <section className="pricing-plans" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">Three ways to use Schwanki</h2>
        <article className="plan-card">
          <p className="landing-eyebrow">Free</p>
          <h3>The whole flashcard app</h3>
          <p className="plan-price">$0 <span>forever</span></p>
          <ul className="plan-checks">
            <li>Unlimited decks and reviews</li>
            <li>Anki import with your review history</li>
            <li>FSRS scheduling in a swipe feed</li>
            <li>Class notes turned into Inbox words</li>
            <li>Free example sentences</li>
            <li>{STARTER_CREDITS} AI credits to try pictures and audio</li>
          </ul>
          {startButton("secondary-button plan-cta")}
        </article>
        <article className="plan-card plan-card-featured">
          <p className="plan-ribbon">Easiest</p>
          <p className="landing-eyebrow">Schwanki AI credits</p>
          <h3>We run the AI for you</h3>
          <p className="plan-price">{perCardCents(cheapest)} <span>a card, at best</span></p>
          <ul className="plan-checks">
            <li>One credit makes a card's picture and audio</li>
            <li>Nothing to set up, no keys to paste</li>
            <li>One-time packs from {formatPrice(CREDIT_PACKS[0]!.priceCents)}. Nothing renews</li>
            <li>Credits don't expire</li>
            <li>You pick which cards get the treatment</li>
          </ul>
          <a href="#packs" className="primary-button plan-cta">Pick a pack</a>
        </article>
        <article className="plan-card">
          <p className="landing-eyebrow">Your own keys</p>
          <h3>Your models, your tokens</h3>
          <p className="plan-price">$0 <span>to Schwanki</span></p>
          <ul className="plan-checks">
            <li>OpenAI, Anthropic, ElevenLabs, fal and more</li>
            <li>Choose the model for each kind</li>
            <li>Your provider bills you directly</li>
            <li>Zero markup. We're not animals</li>
            <li>Mix with credits for anything a key doesn't cover</li>
          </ul>
          {startButton("secondary-button plan-cta")}
        </article>
      </section>

      <section id="packs" className="pricing-packs" aria-labelledby="packs-heading">
        <div className="pricing-section-head">
          <p className="landing-eyebrow">Credit packs</p>
          <h2 id="packs-heading">Pick a pile of credits.</h2>
          <p>Bigger piles cost less per card. Pay once, spend them whenever a word needs a scene.</p>
        </div>
        <CreditPacks packs={CREDIT_PACKS} action={(pack) => signedIn
          ? <a href="/billing#credit-packs" className={pack.id === "plus" ? "primary-button w-full" : "secondary-button w-full"}>Buy {pack.label} · {formatPrice(pack.priceCents)}</a>
          : <button type="button" onClick={() => void start()} disabled={busy} className={pack.id === "plus" ? "primary-button w-full" : "secondary-button w-full"}>Start free, buy later</button>} />
        <p className="pricing-fineprint">Prices in USD. Checkout by Stripe. {signedIn ? "Packs open in Billing, where your receipts live." : "Sign in first. Your free credits arrive before you spend a cent."}</p>
      </section>

      <section className="pricing-costs" aria-labelledby="costs-heading">
        <div className="pricing-section-head">
          <p className="landing-eyebrow">What a credit buys</p>
          <h2 id="costs-heading">One card. One scene. One credit.</h2>
          <p>A credit pays for the picture and the pronunciation on one card. Make both together and it's still one credit.</p>
        </div>
        <dl className="cost-table">{COSTS.map(([what, cost]) => <div key={what}><dt>{what}</dt><dd className={cost === "Free" ? "cost-free" : undefined}>{cost}</dd></div>)}</dl>
      </section>

      <section className="landing-faq" aria-labelledby="pricing-faq-heading"><h2 id="pricing-faq-heading">Money questions,<br />straight answers.</h2><div>
        {pricingFaq(STARTER_CREDITS).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div></section>

      <section className="landing-closer"><img src="/goose.png" alt="The Chaos Goose" className="w-24 shrink-0 sm:w-32" /><div><p className="landing-eyebrow">The goose is waiting</p><h2>Start free.<br />Pay when a word earns it.</h2>{startButton("primary-button")}</div></section>
      <footer className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-ink/70"><span>Schwanki · a modern take on Anki</span><LegalLinks /></footer>
    </main>
  );
}
