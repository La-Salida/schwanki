import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";

// The demo card's clip was generated with Fal from the sentence below, then saved as a static asset.
const DEMO_CLIP = "/demo/goose-steals-homework.mp4";
const DEMO_POSTER = "/demo/goose-steals-homework.jpg";

const steps = [
  { title: "Connect your class notes", body: "Google Sheets, Docs, or the PDF your teacher sent after class." },
  { title: "Approve the fresh loot", body: "New words land in the Inbox. Keep them, fix them, or tell them nah." },
  { title: "Make it memorable", body: "Each word gets a ridiculous sentence, a scene, and audio. You won't forget the goose." },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function DemoCard() {
  const [clipFailed, setClipFailed] = useState(false);
  const still = prefersReducedMotion();
  return (
    <figure className="landing-demo" aria-labelledby="demo-caption">
      <div className="landing-demo-media">
        {clipFailed ? (
          <img src="/goose.png" alt="" className="mx-auto h-full w-auto object-contain p-6" />
        ) : (
          <video
            src={DEMO_CLIP}
            poster={DEMO_POSTER}
            autoPlay={!still}
            controls={still}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Generated scene: the goose snatches a student's homework and waddles off"
            onError={() => setClipFailed(true)}
          />
        )}
        <span className="landing-demo-badge">AI scene</span>
      </div>
      <figcaption id="demo-caption" className="space-y-4 p-6 sm:p-7">
        <p lang="zh" className="landing-demo-sentence">
          那只鹅<mark className="landing-mark">偷</mark>了我的作业。
        </p>
        <p className="text-ink/70">
          Nà zhī é <mark className="landing-mark-soft">tōu</mark> le wǒ de zuòyè.
        </p>
        <p className="text-lg font-bold">
          That goose <mark className="landing-mark-soft">stole</mark> my homework.
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-ink/20 pt-4 text-sm">
          <span lang="zh" className="landing-chip">偷 · tōu</span>
          <span className="text-ink/70">to steal. One word, one scene you can't unsee.</span>
        </div>
      </figcaption>
    </figure>
  );
}

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signIn() {
    setBusy(true); setError(null);
    try { await signInWithGoogle(); }
    catch (failure) { setError(`Couldn't sign in: ${(failure as Error).message}. Try again.`); setBusy(false); }
  }
  return (
    <main id="main-content" className="landing">
      <header className="flex items-center justify-between gap-4 pb-2">
        <span className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <img src="/goose.png" alt="" className="h-9 w-9" />
          Schwanki
        </span>
        <a href="#connect" className="font-bold underline">Sign in</a>
      </header>
      <section className="landing-hero">
        <div className="space-y-7">
          <p className="landing-eyebrow">Flashcards from your own classes</p>
          <h1 className="landing-title">Class is over.<br />The words <mark className="landing-mark">stay</mark>.</h1>
          <p className="max-w-lg text-lg text-ink/70">Schwanki turns your teacher's Google Sheets, Docs, and class PDFs into a review deck, then gives every word a scene too dumb to forget.</p>
          <div id="connect" className="max-w-md space-y-3 scroll-mt-8">
            <button onClick={() => void signIn()} disabled={busy} className="primary-button landing-cta w-full sm:w-auto">
              {busy ? "Opening Google sign-in…" : "Sign in with Google"}
            </button>
            <p className="text-sm text-ink/70">Free to start. Connect a document or upload a PDF after class.</p>
            {error && <p role="alert" className="error-notice">{error}</p>}
          </div>
        </div>
        <DemoCard />
      </section>
      <section aria-labelledby="how-heading" className="border-t border-ink/20 py-10 sm:py-14">
        <h2 id="how-heading" className="mb-8 text-3xl font-black tracking-tight">Lesson in. Deck out.</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="landing-step">
              <span className="landing-step-number" aria-hidden="true">{i + 1}</span>
              <h3 className="text-xl font-black tracking-tight">{step.title}</h3>
              <p className="text-ink/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="landing-closer">
        <img src="/goose.png" alt="The Chaos Goose, Schwanki's notebook thief" className="w-24 shrink-0 sm:w-32" />
        <div className="space-y-4">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">The goose has the notebook.<br />You still have to learn the words.</h2>
          <a href="#connect" className="primary-button">Connect your class notes</a>
        </div>
      </section>
      <footer className="flex flex-wrap justify-between gap-3 py-6 text-sm text-ink/70">
        <span>Schwanki · vocabulary from your own classes</span>
        <a href="#connect" className="font-bold underline">Sign in</a>
      </footer>
    </main>
  );
}
