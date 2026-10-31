import { useEffect, useRef, useState } from "react";
import { recentReviewTimes } from "@/lib/reviewDays";
import { sessionTime, streakFacts, type StreakFacts } from "@/lib/streak";
import { drawShareCard, shareImage } from "@/lib/shareCard";
import { prefersReducedMotion, RatingBurst, type Burst } from "./RatingBurst";
import { WeekDots } from "./WeekDots";

/** Counts from 0 to `target` once, easing out; reduced motion shows the number straight away. */
function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); return; }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

function gooseLine(knownPct: number, streak: number | null): string {
  if (streak && streak >= 7) return "The goose is impressed. Don't ruin it.";
  if (knownPct >= 90) return "The goose has nothing to say. Suspicious.";
  return "The goose has seen your work. That'll do for today.";
}

export function StreakScreen({ reviewed, knew = reviewed, bestRun = 0, startedAt = Date.now() }: {
  reviewed: number; knew?: number; bestRun?: number; startedAt?: number;
}) {
  const [facts, setFacts] = useState<StreakFacts | null>(null);
  const [tick, setTick] = useState(false);
  // Confetti on arrival, and again when the streak ticks up.
  const [burst, setBurst] = useState<Burst | null>(() => (prefersReducedMotion() ? null : { id: 1, knew: true }));
  const [shareNote, setShareNote] = useState<string | null>(null);
  const image = useRef<Promise<Blob | null> | null>(null);
  const [time] = useState(() => sessionTime(Date.now() - startedAt));
  const knownPct = reviewed ? Math.round((knew / reviewed) * 100) : 0;
  const count = useCountUp(reviewed);
  const pct = useCountUp(knownPct);
  const [date] = useState(() => new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));

  useEffect(() => {
    let mounted = true;
    void recentReviewTimes().then((times) => {
      if (mounted && times) setFacts(streakFacts(times, startedAt));
    });
    return () => { mounted = false; };
  }, [startedAt]);

  // When today grew the streak, show yesterday's number first and tick it up once the count settles.
  useEffect(() => {
    if (!facts) return;
    if (!facts.extendedToday || prefersReducedMotion()) { setTick(true); return; }
    const t = window.setTimeout(() => {
      setTick(true);
      setBurst({ id: 2, knew: true });
      navigator.vibrate?.([14, 40, 20]);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [facts]);

  const streak = facts ? (tick || !facts.extendedToday ? facts.streak : facts.streak - 1) : null;
  const line = gooseLine(knownPct, facts?.streak ?? null);

  // Draw the share image ahead of time: Safari only allows sharing straight from the tap.
  useEffect(() => {
    image.current = drawShareCard({ reviewed, knownPct, bestRun, time, streak: facts?.streak ?? null, week: facts?.week ?? null, line, date });
  }, [reviewed, knownPct, bestRun, time, facts, line, date]);

  async function share() {
    const blob = await image.current;
    if (!blob) { setShareNote("Couldn't make the image on this browser."); return; }
    const result = await shareImage(blob, `${reviewed} cards on Schwanki today.`);
    setShareNote(result === "downloaded" ? "Image saved. Post it wherever you like." : null);
  }

  return (
    <div className="finish">
      <section className="finish-card" aria-labelledby="finish-title">
        <img src="/goose.png" alt="" className="finish-goose" />
        <p className="finish-date">{date}</p>
        <h1 id="finish-title" className="sr-only">Queue cleared.</h1>
        <p className="finish-count"><b>{count}</b><span>cards<br />reviewed</span></p>
        <dl className="finish-stats">
          <div><dt>Known</dt><dd>{pct}%</dd></div>
          <div><dt>Best run</dt><dd>{bestRun}</dd></div>
          <div><dt>Time</dt><dd>{time}</dd></div>
        </dl>
        {facts && streak !== null && <div className="finish-streak">
          <p><b key={streak} className={tick && facts.extendedToday ? "finish-streak-tick" : ""}>{streak}</b>-day streak</p>
          <WeekDots week={facts.week} holdToday={!tick} />
        </div>}
        <p className="finish-line">{line}</p>
        <RatingBurst burst={burst} />
      </section>
      <div className="finish-actions">
        <button onClick={() => void share()} className="primary-button">Share this card</button>
        {shareNote && <p role="status" className="text-sm font-bold text-ink/70">{shareNote}</p>}
      </div>
    </div>
  );
}
