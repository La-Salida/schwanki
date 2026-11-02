/**
 * The Chaos Goose in one of its moods. One piece of art (the brand cutout), posed by motion:
 * celebrate: bounces in and waves; judge: leans in and looks at you; sleep: sways with puffs rising.
 * Decoration only, so screen readers skip it.
 */
export type GooseMood = "celebrate" | "judge" | "sleep";

export function Goose({ mood, className = "", say }: { mood: GooseMood; className?: string; say?: string }) {
  return (
    <span className={`goose goose-${mood} ${className}`} aria-hidden="true">
      <img src="/goose.png" alt="" />
      {mood === "sleep" && <span className="goose-zzz"><i /><i /><i /></span>}
      {say && <span className="goose-bubble">{say}</span>}
    </span>
  );
}
