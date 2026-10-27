import { useEffect, useMemo, useState, type CSSProperties } from "react";

/** One celebration per rating: confetti when you knew it, falling goose feathers when you didn't. */
export interface Burst { id: number; knew: boolean }

const CONFETTI = ["#F5D90A", "#8fe39a", "#8cc8ff", "#F4C6D0", "#D6C6E8", "#FAF6EF", "#ff9378"];
const FEATHERS = ["#b9b2a6", "#8f887d", "#d8d2c6", "#9fb0bd"];
const LIFETIME = 1800; // ms, longer than the slowest piece

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

function confetti(id: number): Piece[] {
  const r = seeded(id * 7919);
  return Array.from({ length: 34 }, (_, i) => {
    const round = r() < 0.3;
    const w = round ? 8 + r() * 4 : 6 + r() * 5;
    return {
      className: `burst-confetti ${round ? "burst-round" : ""}`,
      style: {
        width: w, height: round ? w : w * (1.6 + r()),
        background: CONFETTI[i % CONFETTI.length],
        "--x": `${(r() - 0.5) * 90}vw`,
        "--peak": `${-(18 + r() * 30)}vh`,
        "--fall": `${12 + r() * 30}vh`,
        "--r": `${(r() - 0.5) * 1440}deg`,
        animationDuration: `${900 + r() * 450}ms`,
        animationDelay: `${r() * 60}ms`,
      } as CSSProperties,
    };
  });
}

function feathers(id: number): Piece[] {
  const r = seeded(id * 104729);
  return Array.from({ length: 11 }, (_, i) => {
    const size = 18 + r() * 14;
    const tilt = (r() - 0.5) * 50;
    return {
      className: "burst-feather",
      style: {
        left: `${6 + r() * 88}%`, top: `${-4 + r() * 18}%`, width: size, height: size * 2,
        color: FEATHERS[i % FEATHERS.length],
        "--sway": `${(r() < 0.5 ? -1 : 1) * (14 + r() * 26)}px`,
        "--r0": `${tilt - 25}deg`, "--r1": `${tilt + 25}deg`,
        "--drop": `${38 + r() * 26}vh`,
        animationDuration: `${1250 + r() * 450}ms`,
        animationDelay: `${r() * 120}ms`,
      } as CSSProperties,
    };
  });
}

const FEATHER = <svg viewBox="0 0 24 48" aria-hidden="true">
  <path d="M12 1C4.5 9 3.5 25 10.6 39.5L12 47l1.4-7.5C20.5 25 19.5 9 12 1z" fill="currentColor" />
  <path d="M12 7v39" stroke="#1a171255" strokeWidth="1.3" fill="none" />
</svg>;

/** Decoration only: it never takes pointer events and screen readers skip it. */
export function RatingBurst({ burst }: { burst: Burst | null }) {
  const [shown, setShown] = useState<Burst | null>(null);
  useEffect(() => {
    if (!burst) return;
    setShown(burst);
    const t = window.setTimeout(() => setShown((b) => (b?.id === burst.id ? null : b)), LIFETIME);
    return () => window.clearTimeout(t);
  }, [burst]);
  const pieces = useMemo(() => (shown ? (shown.knew ? confetti(shown.id) : feathers(shown.id)) : []), [shown]);
  if (!shown) return null;
  return (
    <div key={shown.id} className={`rating-burst ${shown.knew ? "rating-burst-knew" : "rating-burst-forgot"}`} aria-hidden="true">
      {pieces.map((p, i) => <span key={i} className={p.className} style={p.style}>{shown.knew ? null : FEATHER}</span>)}
    </div>
  );
}
