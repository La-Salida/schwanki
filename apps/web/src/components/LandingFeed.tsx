import { useEffect, useRef, useState, type ReactNode } from "react";
import { FEED_CARDS, type FeedCard } from "@/lib/feedCards";

const CHAPTERS = [
  "Your vocabulary. A different feeling.", "Reveal it. Remember it. Rate it.",
  "Got it. Next word.", "A scene worth remembering.",
  "Keep the words moving.", "A feed with a finish line.",
];

function Highlighted({ parts }: { parts: [string, string, string] }) {
  return <>{parts[0]}<mark className="landing-mark">{parts[1]}</mark>{parts[2]}</>;
}

function SentenceAudio({ card, enabled }: { card: FeedCard; enabled: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = audio.current;
    const stop = () => {
      request.current++;
      el?.pause();
      if (el) el.currentTime = 0;
      setSpeaking(false);
      setLoading(false);
    };
    const visibility = () => { if (document.hidden) stop(); };
    if (!enabled) stop();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);

  async function toggle() {
    const el = audio.current;
    if (!el || !enabled) return;
    if (speaking) {
      request.current++;
      el.pause();
      setSpeaking(false);
      return;
    }
    const version = ++request.current;
    setFailed(false);
    setLoading(true);
    el.currentTime = 0;
    try {
      // A failed media resource needs a fresh load before retrying.
      if (el.error) el.load();
      await el.play();
    } catch {
      if (version === request.current) setFailed(true);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }

  return <>
    <audio ref={audio} src={card.audio} preload="none"
      onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)}
      onError={() => { setFailed(true); setSpeaking(false); setLoading(false); }} />
    {enabled && <div className="hero-sentence-audio">
      <button type="button" onClick={() => void toggle()} disabled={loading}
        aria-label={`${speaking ? "Pause" : "Play"} ${card.language} sentence`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {speaking ? <><path d="M8 5v14M16 5v14" /></> : <><path d="m11 5-6 4H2v6h3l6 4z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>}
        </svg>
        {loading ? "Loading audio…" : speaking ? "Pause sentence" : "Hear the sentence"}
      </button>
      {failed && <p role="status">Couldn’t play the audio. Tap to try again.</p>}
    </div>}
  </>;
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
        <p className="hero-feed-reading">{card.reading} · {card.partOfSpeech}</p>
        <div className="hero-feed-answer" data-revealed={revealed}>
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
export default function LandingFeed({ children, cards = FEED_CARDS }: { children?: ReactNode; cards?: FeedCard[] }) {
  const section = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false));
  const [shortWindow, setShortWindow] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(max-height: 680px)").matches ?? false));
  const [paused, setPaused] = useState(false);
  const [comparing, setComparing] = useState(false);
  const manual = reduced || shortWindow;
  const modern = !comparing;
  const lastPhase = cards.length + 1;
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
        setPhase(Math.round(Math.min(1, Math.max(0, -el.getBoundingClientRect().top / distance)) * lastPhase));
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
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + (el.offsetHeight - window.innerHeight) * next / lastPhase, behavior: "instant" });
    }
  }

  if (!current) return null;
  return (
    <section ref={section} className="landing-scroll-hero" data-reduced={reduced} aria-labelledby="hero-heading">
      <div className="landing-hero-stage" data-engaged={phase > 0}>
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">A modern take on Anki</p>
          <h1 id="hero-heading" className="landing-title">Doomscroll<br />{" "}your <mark className="landing-mark">vocab</mark>.</h1>
          <p className="landing-hero-description">Your Anki decks, reimagined for your thumb. Keep your cards and review history. Give stubborn words a scene you’ll remember.</p>
          {children}
          <a href="#your-decks" className="hero-skip">Skip the demo ↗</a>
        </div>
        <div className="hero-experience">
          <div className="hero-comparison-label"><span>{modern ? "The Schwanki feed" : "The familiar review"}</span>{!done && <button type="button" aria-pressed={comparing} onClick={() => setComparing(!comparing)}>{comparing ? "Back to Schwanki ↗" : "Compare with Anki ↔"}</button>}</div>
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
              <div className="hero-demo-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / cards.length})` }} /></div>
              <div className="hero-feed-track" style={{ transform: `translateY(-${active * 100}%)` }}>
                {cards.map((card, i) => <FeedSlide key={card.id} card={card} active={modern && !done && i === active} revealed={phase >= 1} playing={modern && !done && !reduced && !paused && i === active} />)}
              </div>
              <div className="hero-feed-ratings" aria-label="Example rating choices">
                {["Again", "Hard", "Good", "Easy"].map((rating) => <span key={rating} data-selected={phase >= 2 && rating === "Good"}>{rating}</span>)}
              </div>
            </div>
            {done && <div className="hero-feed-complete"><img src="/goose.png" alt="" /><p className="landing-eyebrow">You’re caught up</p><h2>That’s the feed.</h2><p>You out-scrolled your due cards.<br />Imagine it with your vocabulary.</p><a href="#connect" className="primary-button">Bring your Anki deck</a></div>}
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
