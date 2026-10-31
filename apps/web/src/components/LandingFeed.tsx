import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FEED_CARDS, type FeedCard } from "@/lib/feedCards";
import SentenceAudio from "./SentenceAudio";

const CHAPTERS = [
  "Your vocabulary. A different feeling.", "Reveal it. Remember it. Rate it.",
  "Got it. Next word.", "A scene worth remembering.",
  "Keep the words moving.", "A feed with a finish line.",
];

function Highlighted({ parts }: { parts: [string, string, string] }) {
  return <>{parts[0]}<mark className="landing-mark">{parts[1]}</mark>{parts[2]}</>;
}

function FeedSlide({ card, active, revealed, playing }: { card: FeedCard; active: boolean; revealed: boolean; playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (active && playing) void el.play()?.catch(() => {});
    else el.pause();
  }, [active, playing]);
  return (
    <article className="hero-feed-slide" aria-hidden={!active}>
      {failed ? <img src={card.poster} alt="" className="feed-video" /> : (
        <video ref={video} src={card.clip} poster={card.poster} muted loop playsInline
          preload={active ? "metadata" : "none"} className="feed-video"
          style={{ objectPosition: card.focus ?? "center" }} onError={() => setFailed(true)} />
      )}
      <div className="hero-feed-shade" />
      <div className="hero-feed-content">
        <span className="feed-language">{card.language}</span>
        <p lang={card.lang} className="hero-feed-word">{card.word}</p>
        <div className="hero-feed-answer" data-revealed={revealed}>
          <p className="hero-feed-reading">{card.reading} · {card.partOfSpeech}</p>
          <p className="hero-feed-meaning">{card.meaning}</p>
          <p lang={card.lang} className="hero-feed-sentence"><Highlighted parts={card.sentence} /></p>
          <p className="hero-feed-translation">{card.translation.join("")}</p>
          <SentenceAudio card={card} enabled={active && revealed} />
        </div>
        {!revealed && <p className="hero-reveal-hint">↑ Reveal the meaning</p>}
      </div>
    </article>
  );
}

/** Page scroll drives an illustrated review; it never writes actual ratings. */
export default function LandingFeed({ children, cards = FEED_CARDS, onStart }: { children?: ReactNode; cards?: FeedCard[]; onStart?: () => void }) {
  const section = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false));
  const [shortWindow, setShortWindow] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(max-height: 680px)").matches ?? false));
  const [paused, setPaused] = useState(false);
  const [comparing, setComparing] = useState(false);
  const manual = reduced || shortWindow;
  const modern = !comparing;
  const lastPhase = cards.length + 1;
  const steps = ["Start", ...cards.map((card) => card.language.replace(/ \(.*\)$/, "")), "Caught up"];
  const done = phase === lastPhase;
  const active = Math.min(Math.max(phase - 1, 0), cards.length - 1);
  const current = cards[active];
  const captionIndex = done ? CHAPTERS.length - 1 : phase < 2 ? phase : 2 + (phase - 2) % 3;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query?.matches ?? false);
    update();
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.("(max-height: 680px)");
    const update = () => setShortWindow(query?.matches ?? false);
    update();
    query?.addEventListener("change", update);
    return () => query?.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (manual) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const distance = el.offsetHeight - window.innerHeight;
      if (distance > 0) {
        // Equal scroll bands per step, so each card holds for most of a screen.
        const progress = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / distance));
        setPhase(Math.min(lastPhase, Math.floor(progress * (lastPhase + 1))));
        setComparing(false);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [manual, lastPhase]);

  function goTo(next: number) {
    setPhase(next);
    setComparing(false);
    const el = section.current;
    if (!manual && el) {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + (el.offsetHeight - window.innerHeight) * (next + .5) / (lastPhase + 1), behavior: "instant" });
    }
  }

  if (!current) return null;
  return (
    <section ref={section} className="landing-scroll-hero" data-reduced={reduced} style={{ "--hero-steps": lastPhase + 1 } as CSSProperties} aria-labelledby="hero-heading">
      <div className="landing-hero-stage" data-engaged={phase > 0}>
        <div className="landing-hero-copy">
          <h1 id="hero-heading" className="landing-title">Doomscroll<br />{" "}your <mark className="landing-mark">vocab</mark>.</h1>
          <p className="landing-hero-description">A modern take on Anki. Bring your deck with its review history, swipe through today’s due cards like a feed, and stop when they run out.</p>
          {children}
          <a href="#your-decks" className="hero-skip">Skip the demo</a>
        </div>
        <nav className="hero-steps" aria-label="Demo steps">
          <ol>
            {steps.map((label, i) => (
              <li key={i} data-state={i === phase ? "current" : i < phase ? "done" : "next"}>
                <button type="button" onClick={() => goTo(i)} aria-current={i === phase ? "step" : undefined}><span className="hero-step-dot" /><span className="hero-step-label">{label}</span></button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="hero-experience">
          <div className="hero-comparison-label"><span>{modern ? "The Schwanki feed" : "The familiar review"}</span>{!done && <button type="button" aria-pressed={comparing} onClick={() => setComparing(!comparing)}>{comparing ? "Back to Schwanki" : "Compare with Anki ↔"}</button>}</div>
          <div className="hero-device" data-modern={modern} role="group" aria-label="Illustrated Anki-to-Schwanki review demo">
            <div className="hero-classic" aria-hidden={modern}>
              <div className="classic-toolbar">Anki-style review <span>Illustration</span></div>
              <div className="classic-card">
                <p className="classic-deck">{current.language} vocabulary</p>
                <p lang={current.lang} className="classic-word">{current.word}</p>
                <div className="classic-answer"><hr /><p>{current.reading}</p><strong>{current.meaning}</strong></div>
              </div>
              <div className="classic-bottom">
                <p>1 + 0 + 3</p>
                <div className="classic-ratings"><span>Again</span><span>Hard</span><span>Good</span><span>Easy</span></div>
              </div>
            </div>
            <div className="hero-modern" aria-hidden={!modern || done}>
              <div className="hero-feed-track" style={{ transform: `translateY(-${active * 100}%)` }}>
                {cards.map((card, i) => <FeedSlide key={card.id} card={card} active={modern && !done && i === active} revealed={phase >= 1} playing={modern && !done && !reduced && !paused && i === active} />)}
              </div>
              <div className="hero-feed-ratings" aria-label="Example rating choices">
                {["Again", "Hard", "Good", "Easy"].map((rating) => <span key={rating} data-selected={phase >= 2 && rating === "Good"}>{rating}</span>)}
              </div>
            </div>
            {done && <div className="hero-feed-complete"><img src="/goose.png" alt="" /><h2>Caught up.</h2><p>The feed stops when today’s due cards run out.<br />Yours can start with the Anki deck you already have.</p>{onStart ? <button type="button" onClick={onStart} className="primary-button">Import my Anki deck</button> : <a href="#connect" className="primary-button">Import my Anki deck</a>}</div>}
          </div>
          <div className="hero-demo-controls">
            <button type="button" aria-label="Previous demo step" onClick={() => goTo(Math.max(0, phase - 1))} disabled={phase === 0}>←</button>
            <div><span className="hero-demo-caption" aria-live="polite">{comparing ? "Same word. The familiar review." : CHAPTERS[captionIndex]}</span><span className="hero-demo-disclaimer">{manual ? "Use the arrows" : "Scroll to explore"} · Demo only · Tap to hear sentences</span></div>
            <button type="button" aria-label="Next demo step" onClick={() => goTo(Math.min(lastPhase, phase + 1))} disabled={done}>→</button>
          </div>
          {modern && !done && !reduced && <button type="button" className="hero-media-toggle" onClick={() => setPaused(!paused)}>{paused || reduced ? "Scenes paused" : "Pause scenes"}</button>}
        </div>
      </div>
    </section>
  );
}
