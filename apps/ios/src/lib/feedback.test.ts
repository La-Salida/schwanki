import { expect, it } from 'vitest';
import { afterRating, dayKey, freshStats, isMilestone, milestoneLine, sessionTime, streakFacts } from './feedback';

it('counts runs of known cards and resets them on Forgot', () => {
  let s = freshStats(0);
  for (const r of ['good', 'hard', 'easy', 'again', 'good'] as const) s = afterRating(s, r);
  expect(s).toMatchObject({ reviewed: 5, knew: 4, run: 1, bestRun: 3 });
});

it('marks 5, 10, 25 and every 50 as milestones with a line from the goose', () => {
  expect([5, 10, 25, 50, 100].every(isMilestone)).toBe(true);
  expect([1, 4, 6, 24, 75].some(isMilestone)).toBe(false);
  expect(milestoneLine(5)).toBe('The goose noticed.');
  expect(milestoneLine(6)).toBeNull();
});

const now = new Date(2026, 10, 4, 20, 0);
const at = (daysAgo: number, hour = 12) => new Date(2026, 10, 4 - daysAgo, hour).toISOString();

it('counts today even before this session has synced, and knows when today extended the streak', () => {
  const f = streakFacts([at(1), at(2)], now.getTime() - 60_000, now);
  expect(f.streak).toBe(3);
  expect(f.extendedToday).toBe(true);
  expect(f.week.map(d => d.done)).toEqual([false, false, false, false, true, true, true]);
  expect(streakFacts([at(0, 9), at(1)], now.getTime() - 60_000, now).extendedToday).toBe(false);
  expect(streakFacts([at(2)], now.getTime(), now).streak).toBe(1);
});

it('uses local days and short times', () => {
  expect(dayKey(now)).toBe('2026-11-04');
  expect(sessionTime(42_000)).toBe('42 s');
  expect(sessionTime(6 * 60_000)).toBe('6 min');
});
