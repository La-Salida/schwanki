/**
 * The Chaos Goose in one of its moods, each its own drawing (docs/brand/mascot/POSES.md) with a
 * little motion on top: celebrate bounces, judge leans in, sleep breathes. Decoration only, so
 * screen readers skip it.
 */
export type GooseMood = "celebrate" | "judge" | "sleep";

export function Goose({ mood, className = "", say }: { mood: GooseMood; className?: string; say?: string }) {
  return (
    <span className={`goose goose-${mood} ${className}`} aria-hidden="true">
      <img src={`/goose-${mood}.png`} alt="" />
      {say && <span className="goose-bubble">{say}</span>}
    </span>
  );
}
