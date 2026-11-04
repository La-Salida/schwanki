import type { ReviewRating } from '@schwanki/core';

/** What a session has done so far: cards known, the current and best run of Got its, when it began. */
export interface SessionStats { reviewed: number; knew: number; run: number; bestRun: number; startedAt: number }
export const freshStats = (now = Date.now()): SessionStats => ({ reviewed: 0, knew: 0, run: 0, bestRun: 0, startedAt: now });

/** Hard still counts as a pass, as in Anki. */
export const knewIt = (rating: ReviewRating) => rating !== 'again';

export function afterRating(s: SessionStats, rating: ReviewRating): SessionStats {
  const knew = knewIt(rating);
  const run = knew ? s.run + 1 : 0;
  return { ...s, reviewed: s.reviewed + 1, knew: s.knew + (knew ? 1 : 0), run, bestRun: Math.max(s.bestRun, run) };
}

/** Runs 5, 10, 25, 50, then every 50: each one gets a bigger burst and a line from the goose. */
export function isMilestone(run: number): boolean {
  return run === 5 || run === 10 || run === 25 || (run >= 50 && run % 50 === 0);
}
export function milestoneLine(run: number): string | null {
  if (run === 5) return 'The goose noticed.';
  if (run === 10) return 'The goose is getting nervous.';
  if (run === 25) return 'The goose wants its words back.';
  if (run >= 50 && run % 50 === 0) return 'The goose has left the building.';
  return null;
}

export function gooseLine(knownPct: number, streak: number | null): string {
  if (streak && streak >= 7) return "The goose is impressed. Don't ruin it.";
  if (knownPct >= 90) return 'The goose has nothing to say. Suspicious.';
  return "The goose has seen your work. That'll do for today.";
}

/** Local calendar day, so a late session doesn't count as yesterday in UTC. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export interface WeekDay { label: string; done: boolean; today: boolean }
export interface StreakFacts { streak: number; extendedToday: boolean; week: WeekDay[] }

/** Streak facts after a finished session. Today always counts: this session's ratings may still be waiting to sync. */
export function streakFacts(reviewedAt: string[], startedAt: number, now = new Date()): StreakFacts {
  const today = dayKey(now);
  const days = new Set(reviewedAt.map(t => dayKey(new Date(t))));
  days.add(today);
  const earlierToday = reviewedAt.some(t => Date.parse(t) < startedAt && dayKey(new Date(t)) === today);
  let streak = 0;
  const cursor = new Date(now);
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const week: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    week.push({ label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), done: days.has(dayKey(d)), today: i === 0 });
  }
  return { streak, extendedToday: !earlierToday, week };
}

export function sessionTime(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}
