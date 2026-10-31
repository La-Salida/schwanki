/** Local calendar day, so a 1am session in Seoul doesn't count as yesterday in UTC. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface WeekDay { label: string; done: boolean; today: boolean }
export interface StreakFacts {
  streak: number;
  /** True when this session is the first review today, so the streak just grew by one. */
  extendedToday: boolean;
  /** The last seven days, oldest first. */
  week: WeekDay[];
}

/**
 * Streak facts after a finished session. Today always counts: the session's own ratings may
 * still be waiting in the outbox, so they can be missing from `reviewedAt`.
 */
export function streakFacts(reviewedAt: string[], startedAt: number, now = new Date()): StreakFacts {
  const today = dayKey(now);
  const days = new Set(reviewedAt.map((t) => dayKey(new Date(t))));
  days.add(today);
  const earlierToday = reviewedAt.some((t) => Date.parse(t) < startedAt && dayKey(new Date(t)) === today);
  let streak = 0;
  const cursor = new Date(now);
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return { streak, extendedToday: !earlierToday, week: lastWeek(days, now) };
}

export interface HomeStreak {
  /** Days in a row up to today, or up to yesterday while today is still open. */
  streak: number;
  reviewedToday: boolean;
  week: WeekDay[];
}

/** The streak as the home screen sees it: a streak that ended yesterday is still alive until midnight. */
export function homeStreak(reviewedAt: string[], now = new Date()): HomeStreak {
  const days = new Set(reviewedAt.map((t) => dayKey(new Date(t))));
  const reviewedToday = days.has(dayKey(now));
  let streak = 0;
  const cursor = new Date(now);
  if (!reviewedToday) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return { streak, reviewedToday, week: lastWeek(days, now) };
}

function lastWeek(days: Set<string>, now: Date): WeekDay[] {
  const week: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    week.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), done: days.has(dayKey(d)), today: i === 0 });
  }
  return week;
}

export function sessionTime(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}
