import type { WeekDay } from "@/lib/streak";

/** This week at a glance: one dot per day, today ringed. `holdToday` leaves today empty until a tick. */
export function WeekDots({ week, holdToday = false, tone = "paper" }: { week: WeekDay[]; holdToday?: boolean; tone?: "paper" | "ink" }) {
  return (
    <ol className={`week-dots week-dots-${tone}`} aria-label="This week">
      {week.map((d, i) => (
        <li key={i} data-done={(d.done && !(d.today && holdToday)) || undefined} data-today={d.today || undefined}
          aria-label={`${d.today ? "Today" : d.label}: ${d.done ? "reviewed" : "no reviews"}`}>{d.label}</li>
      ))}
    </ol>
  );
}
