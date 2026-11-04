import { useEffect, useState } from "react";
import { FEED_CARDS } from "@/lib/feedCards";

/**
 * The hero's moving centerpiece: the goose changes pose while a word from the demo deck
 * cycles above the headline, in its own language. Decoration only; the h1 carries the meaning.
 */
const POSES = ["/goose-hero.webp", "/goose-judge.png", "/goose-celebrate.png", "/goose-sleep.png"];
const WORDS = FEED_CARDS.map(({ word, lang }) => ({ word, lang }));
const STEP_MS = 2600;

export function HeroGoose() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setI((n) => n + 1);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, []);
  const pose = i % POSES.length;
  const word = WORDS[i % WORDS.length]!;
  return (
    <div className="hero-goose" aria-hidden="true">
      <div className="hero-goose-stage">
        {POSES.map((src, n) => <img key={src} src={src} alt="" data-active={n === pose} fetchPriority={n === 0 ? "high" : "low"} />)}
      </div>
      <p key={i} lang={word.lang} className="hero-goose-word">{word.word}</p>
    </div>
  );
}
