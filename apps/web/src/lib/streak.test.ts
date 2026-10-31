import { expect, it } from "vitest";
import { dayKey, homeStreak, sessionTime, streakFacts } from "./streak";

const now = new Date(2026, 9, 31, 20, 0);
const at = (daysAgo: number, hour = 12) => new Date(2026, 9, 31 - daysAgo, hour).toISOString();

it("counts today even when this session's ratings haven't synced yet", () => {
  const f = streakFacts([at(1), at(2)], now.getTime() - 60_000, now);
  expect(f.streak).toBe(3);
  expect(f.extendedToday).toBe(true);
  expect(f.week.map((d) => d.done)).toEqual([false, false, false, false, true, true, true]);
  expect(f.week[6]!.today).toBe(true);
});

it("doesn't claim the streak grew when the learner already reviewed earlier today", () => {
  const f = streakFacts([at(0, 9), at(1)], now.getTime() - 60_000, now);
  expect(f.streak).toBe(2);
  expect(f.extendedToday).toBe(false);
});

it("starts over after a missed day", () => {
  expect(streakFacts([at(2), at(3)], now.getTime(), now).streak).toBe(1);
});

it("uses the local calendar day and short session times", () => {
  expect(dayKey(now)).toBe("2026-10-31");
  expect(sessionTime(42_000)).toBe("42 s");
  expect(sessionTime(6 * 60_000)).toBe("6 min");
});

it("keeps yesterday's streak alive on the home screen until today is reviewed", () => {
  const open = homeStreak([at(1), at(2)], now);
  expect(open).toMatchObject({ streak: 2, reviewedToday: false });
  expect(homeStreak([at(0, 9), at(1)], now)).toMatchObject({ streak: 2, reviewedToday: true });
  expect(homeStreak([at(3)], now).streak).toBe(0);
});
