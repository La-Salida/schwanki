import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth";

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
      <header className="flex items-center justify-between gap-4 border-b border-ink/20 pb-5">
        <span className="text-2xl font-black tracking-tight">Schwanki</span>
        <a href="#connect" className="font-bold underline">Sign in</a>
      </header>
      <section className="landing-hero">
        <div className="space-y-6">
          <h1 className="landing-title">Class is over.<br />The words stay.</h1>
          <p className="max-w-lg text-lg text-ink/70">Turn your teacher's Google Sheets, Docs, and class PDFs into flashcards. Check the words, fix missing pinyin or meanings, then review that class.</p>
          <div id="connect" className="max-w-md space-y-3 scroll-mt-8">
            <button onClick={() => void signIn()} disabled={busy} className="primary-button w-full sm:w-auto">
              {busy ? "Opening Google sign-in…" : "Sign in with Google"}
            </button>
            <p className="text-sm text-ink/70">Connect a Google document or upload a PDF after class.</p>
            {error && <p role="alert" className="error-notice">{error}</p>}
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md pt-10">
          <img src="/goose.png" alt="The Chaos Goose, Schwanki's notebook thief" className="absolute -top-5 right-5 w-20 sm:-top-8 sm:w-24" />
          <div className="landing-example">
            <p className="mb-8 text-sm font-bold text-ink/70">Example vocabulary from a class PDF</p>
            <p lang="zh" className="review-word font-black">明显</p>
            <p className="mt-4 text-2xl font-bold">obvious</p>
            <p className="mt-8 border-t border-ink/20 pt-4 text-sm text-ink/70">Missing pinyin can be edited by hand. Ask for a suggestion when you need help, then check it before saving.</p>
          </div>
        </div>
      </section>
      <section className="grid gap-6 border-y border-ink/20 py-8 sm:grid-cols-[1fr_1.3fr] sm:py-10">
        <h2 className="max-w-xs text-3xl font-black tracking-tight">Your teachers' notes.<br />Your review queue.</h2>
        <div className="space-y-4 text-ink/70">
          <p>Keep a Google source connected as your teacher adds vocabulary. For PDFs, upload each class as its own file so earlier lessons keep their cards.</p>
          <p>New words land in the Inbox for you to approve. Review across your teachers or open one class when you want to revisit it.</p>
          <p className="font-bold text-ink">The goose has the notebook. You still have to learn the words.</p>
        </div>
      </section>
      <footer className="flex flex-wrap justify-between gap-3 py-6 text-sm text-ink/70">
        <span>Schwanki · vocabulary from your own classes</span>
        <a href="#connect" className="font-bold underline">Connect your class notes</a>
      </footer>
    </main>
  );
}
