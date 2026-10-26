import { useEffect, useState } from "react";
import { STARTER_CREDITS } from "@schwanki/mnemonic";
import { signInWithGoogle } from "@/lib/auth";
import LandingFeed from "@/components/LandingFeed";
import SentenceAudio from "@/components/SentenceAudio";
import { FEED_CARDS } from "@/lib/feedCards";

const SIGN_IN_TIMEOUT_MS = 15_000;

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // If the browser never leaves for Google (a network blocking supabase.co, a swallowed
  // navigation in an installed app), don't leave the button spinning forever.
  useEffect(() => {
    if (!busy) return;
    const stall = window.setTimeout(() => {
      setBusy(false);
      setError("Google sign-in didn't open. Check your connection and try again. If it keeps happening, open schwankiapp.com in your phone's browser instead of the home-screen app.");
    }, SIGN_IN_TIMEOUT_MS);
    return () => window.clearTimeout(stall);
  }, [busy]);
  async function signIn() {
    setBusy(true); setError(null);
    try { await signInWithGoogle(); }
    catch (failure) { setError(`Couldn't sign in: ${(failure as Error).message}. Try again.`); setBusy(false); }
  }
  return (
    <main id="main-content" className="landing">
      <header className="landing-nav">
        <a href="#main-content" className="flex items-center gap-2 text-2xl font-black tracking-tight" aria-label="Schwanki home"><img src="/goose.png" alt="" className="h-9 w-9" />Schwanki</a>
        <nav aria-label="Landing navigation"><a href="#your-decks">Your decks</a><a href="#connect">Sign in ↗</a></nav>
      </header>
      <LandingFeed>
        <div id="connect" className="hero-connect">
          <button onClick={() => void signIn()} disabled={busy} className="primary-button landing-cta">
            {busy ? "Opening Google sign-in…" : "Bring your Anki deck"}
          </button>
          <p>{STARTER_CREDITS} free AI credits · Continue with Google</p>
          {error && <p role="alert" className="error-notice">{error}</p>}
        </div>
      </LandingFeed>

      <section id="your-decks" className="landing-import landing-editorial" aria-labelledby="import-heading">
        <div><p className="landing-eyebrow">01 / Bring what you know</p><h2 id="import-heading">Your deck has history.<br />Bring it.</h2><p>All those reviews count. Import your Anki cards with their scheduling, review history, pictures, and audio. Pick up with the words you already know—and the ones you keep forgetting.</p><a href="#connect" className="landing-text-link">Bring my deck ↗</a></div>
        <div className="import-illustration" role="img" aria-label="Anki export becomes a Schwanki deck, with cards, scheduling, review history and media preserved">
          <div className="import-file"><span aria-hidden="true">↗</span><strong>Your vocabulary.apkg</strong><span>.apkg or .colpkg</span></div>
          <span className="import-arrow" aria-hidden="true">↓</span>
          <div className="import-result"><span className="landing-eyebrow">Ready for a new routine</span><strong>Same words.<br />Fresh start.</strong><ul><li>✓ Cards &amp; scheduling</li><li>✓ Review history</li><li>✓ Pictures &amp; audio</li></ul><span className="import-destination">Straight into your deck →</span></div>
        </div>
      </section>

      <section className="landing-memory landing-editorial" aria-labelledby="memory-heading">
        <div className="memory-example"><img src="/demo/goose-steals-homework.jpg" alt="An illustrated goose running away with a student's homework" loading="lazy" /><div><span className="landing-eyebrow">One word. Something to picture.</span><p lang="zh">那只鹅<mark className="landing-mark">偷</mark>了我的作业。</p><p>That goose <mark className="landing-mark">stole</mark> my homework.</p><SentenceAudio card={{ audio: FEED_CARDS[0]!.audio, language: "Chinese homework" }} enabled /></div></div>
        <div><p className="landing-eyebrow">02 / Make it memorable</p><h2 id="memory-heading">Some words need<br />a ridiculous scene.</h2><p>Add an example sentence, an image, and pronunciation audio to the words that won’t stick. Give your brain something to work with.</p><p className="memory-funding">Use Schwanki credits, or bring your own AI keys. You choose which cards get the treatment.</p></div>
      </section>

      <section className="landing-learning" aria-labelledby="learning-heading"><p className="landing-eyebrow">The method behind the motion</p><h2 id="learning-heading">A feed with a finish line.</h2><p>FSRS schedules your reviews. You recall the word, reveal the answer, and rate how well you remembered. The queue ends. Go live a little.</p><ol><li><span>01</span> Recall</li><li><span>02</span> Reveal</li><li><span>03</span> Rate</li><li><span>✓</span> You’re done</li></ol></section>

      <section className="landing-notes landing-editorial" aria-labelledby="notes-heading">
        <div><p className="landing-eyebrow">03 / Keep collecting</p><h2 id="notes-heading">You already wrote<br />it down once.</h2><p>Your class notes have the next words worth learning. Bring in Google Sheets, Docs, or class PDFs, including Canva exports. Check the suggested vocabulary in your Inbox. Keep it, correct it, or tell it nah.</p><p className="text-sm text-ink/70">Anki imports go straight to your deck. Vocabulary extracted from notes waits for your approval.</p></div>
        <div><div className="notes-example" role="img" aria-label="Illustration of class notes becoming a vocabulary suggestion"><div className="notes-source"><span>CLASS NOTES / CHINESE</span><p lang="zh">来不及</p><p>not enough time</p><p lang="zh">我来不及吃早饭。</p></div><span className="import-arrow" aria-hidden="true">↓</span><div className="notes-inbox"><span className="landing-eyebrow">Suggested vocabulary · Preview</span><strong lang="zh">来不及 <span>lái bu jí</span></strong><p>not enough time</p><span className="notes-approval">You check it → Into the deck</span></div></div><SentenceAudio card={{ audio: "/demo/sentence-notes-zh.mp3", language: "Chinese notes" }} enabled /></div>
      </section>

      <section className="landing-faq" aria-labelledby="faq-heading"><h2 id="faq-heading">A few things<br />before you scroll.</h2><div>
        <details><summary>What comes over from Anki?</summary><p>Import an .apkg or .colpkg export. Your cards come with their scheduling state, review history, and supported pictures and audio.</p></details>
        <details><summary>Do I need an app?</summary><p>Open Schwanki in your browser or add it to your phone’s home screen. Phone review uses the feed; desktop review keeps the flashcard layout.</p></details>
        <details><summary>Can I review offline?</summary><p>Once your due cards are cached, you can review offline. Your ratings sync when you reconnect.</p></details>
        <details><summary>How does the AI work?</summary><p>New accounts start with {STARTER_CREDITS} free AI credits to try pictures and audio. Sentences are free. Choose a card to enhance, or add your own provider keys in Settings. Imported cards don’t need AI generation to be reviewed.</p></details>
      </div></section>

      <section className="landing-closer"><img src="/goose.png" alt="The Chaos Goose" className="w-24 shrink-0 sm:w-32" /><div><p className="landing-eyebrow">The goose is waiting</p><h2>Your thumb knows what to do.<br />Give it your vocabulary.</h2><a href="#connect" className="primary-button">Bring your Anki deck</a></div></section>
      <footer className="flex flex-wrap justify-between gap-3 py-6 text-sm text-ink/70"><span>Schwanki · a modern take on Anki</span><a href="#connect" className="font-bold underline">Sign in ↗</a></footer>
    </main>
  );
}
