import { useEffect, useRef, useState } from "react";
import { FEED_CARDS, type FeedCard } from "@/lib/feedCards";

function reducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Highlighted({ parts, className }: { parts: [string, string, string]; className: string }) {
  return <>{parts[0]}<mark className={className}>{parts[1]}</mark>{parts[2]}</>;
}

function FeedSlide({ card, active }: { card: FeedCard; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el || typeof el.play !== "function") return;
    if (active && !reducedMotion()) void el.play()?.catch(() => {});
    else el.pause();
  }, [active]);
  return (
    <article className="feed-slide" aria-hidden={!active} data-active={active}>
      <video ref={video} src={card.clip} poster={card.poster} muted loop playsInline preload={active ? "auto" : "none"} className="feed-video" style={{ objectPosition: card.focus ?? "center" }} />
      <div className="feed-overlay">
        <span className="feed-language">{card.language}</span>
        <p lang={card.lang} className="feed-word">{card.word}</p>
        <p className="feed-reading">{card.reading} · {card.partOfSpeech} · <strong>{card.meaning}</strong></p>
        <p lang={card.lang} className="feed-sentence"><Highlighted parts={card.sentence} className="landing-mark" /></p>
        {card.romanized && <p className="feed-small"><Highlighted parts={card.romanized} className="feed-mark-soft" /></p>}
        <p className="feed-small font-bold"><Highlighted parts={card.translation} className="feed-mark-soft" /></p>
      </div>
    </article>
  );
}

/** Scrolling the page moves the phone from one word to the next, like a social feed. */
export default function LandingFeed({ cards = FEED_CARDS }: { cards?: FeedCard[] }) {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    // The step whose middle is nearest the viewport's middle decides which card the phone shows.
    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let nearest = 0;
      let best = Infinity;
      steps.current.forEach((step, i) => {
        if (!step) return;
        const box = step.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (distance < best) { best = distance; nearest = i; }
      });
      setActive(nearest);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cards.length]);
  return (
    <section aria-labelledby="feed-heading" className="feed-section">
      <h2 id="feed-heading" className="feed-heading">Scroll like it's a feed.<br />Remember like it's Anki.</h2>
      <div className="feed-phone-wrap">
        <div className="feed-phone" role="group" aria-label={`Example card: ${cards[active]?.language}, ${cards[active]?.word}`}>
          <div className="feed-track" style={{ transform: `translateY(-${active * 100}%)` }}>
            {cards.map((card, i) => <FeedSlide key={card.id} card={card} active={i === active} />)}
          </div>
          <div className="feed-dots" aria-hidden="true">
            {cards.map((card, i) => <span key={card.id} data-on={i === active} />)}
          </div>
        </div>
      </div>
      <ol className="feed-steps">
        {cards.map((card, i) => (
          <li key={card.id} ref={(el) => { steps.current[i] = el; }} data-index={i} data-on={i === active} className="feed-step">
            <p className="landing-eyebrow">{card.language}</p>
            <p className="text-2xl font-black tracking-tight"><span lang={card.lang}>{card.word}</span> · {card.meaning}</p>
            <p className="text-ink/70"><Highlighted parts={card.translation} className="feed-mark-soft" /></p>
          </li>
        ))}
      </ol>
    </section>
  );
}
