import { useEffect, useMemo, useState, type CSSProperties } from "react";

/** One beat of feedback per rating: confetti when you knew it, a red "Forgot" thud when you didn't.
 * Nothing falls on a miss, so it can never be mistaken for a celebration. */
export interface Burst { id: number; knew: boolean; /** Cards known in a row, this one included. */ run?: number }

const CONFETTI = ["#F5D90A", "#8fe39a", "#8cc8ff", "#F4C6D0", "#D6C6E8", "#FAF6EF", "#ff9378"];
const LIFETIME = 1900; // ms, longer than the slowest piece

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
}

// Small seeded generator so a burst keeps its shape across re-renders.
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Piece = { style: CSSProperties; className: string };

/** The goose's reaction at 5, 10, 25 and every 50 in a row. */
export function milestoneLine(run: number): string | null {
  if (run === 5) return "The goose noticed.";
  if (run === 10) return "The goose is getting nervous.";
  if (run === 25) return "The goose wants its words back.";
  if (run >= 50 && run % 50 === 0) return "The goose has left the building.";
  return null;
}

export function confetti(id: number, count = 34, spread = 1): Piece[] {
  const r = seeded(id * 7919);
  return Array.from({ length: count }, (_, i) => {
    const round = r() < 0.3;
    const w = round ? 8 + r() * 4 : 6 + r() * 5;
    return {
      className: `burst-confetti ${round ? "burst-round" : ""}`,
      style: {
        width: w, height: round ? w : w * (1.6 + r()),
        background: CONFETTI[i % CONFETTI.length],
        "--x": `${(r() - 0.5) * 90 * spread}vw`,
        "--peak": `${-(18 + r() * 30) * spread}vh`,
        "--fall": `${12 + r() * 30}vh`,
        "--r": `${(r() - 0.5) * 1440}deg`,
        animationDuration: `${900 + r() * 450}ms`,
        animationDelay: `${r() * 60}ms`,
      } as CSSProperties,
    };
  });
}

/** Decoration only: it never takes pointer events and screen readers skip it. */
export function RatingBurst({ burst }: { burst: Burst | null }) {
  const [shown, setShown] = useState<Burst | null>(null);
  useEffect(() => {
    if (!burst) return;
    setShown(burst);
    const t = window.setTimeout(() => setShown((b) => (b?.id === burst.id ? null : b)), LIFETIME);
    return () => window.clearTimeout(t);
  }, [burst]);
  const line = shown?.knew ? milestoneLine(shown.run ?? 0) : null;
  const pieces = useMemo(() => (shown?.knew ? confetti(shown.id, line ? 80 : 34, line ? 1.25 : 1) : []), [shown, line]);
  if (!shown) return null;
  return (
    <div key={shown.id} className={`rating-burst ${shown.knew ? "rating-burst-knew" : "rating-burst-forgot"}`} aria-hidden="true">
      {shown.knew
        ? pieces.map((p, i) => <span key={i} className={p.className} style={p.style} />)
        : <p className="burst-forgot-stamp">✗ Forgot<span>It’ll come back soon</span></p>}
      {line && <p className="burst-milestone"><b>{shown.run} in a row</b><span>{line}</span></p>}
    </div>
  );
}
