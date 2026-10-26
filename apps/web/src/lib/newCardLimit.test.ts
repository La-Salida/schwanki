import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ api: { countNewStarted: vi.fn().mockRejectedValue(new Error("offline")) } }));
import { DEFAULT_NEW_LIMIT, NEW_LIMIT_KEY, newCardAllowance, noteNewStarted, readNewLimit, studyDayStart } from "./newCardLimit";

afterEach(() => localStorage.clear());

it("starts the study day at 4am, so a late-night session counts toward the day before", () => {
  expect(studyDayStart(new Date(2026, 9, 26, 2, 30)).getTime()).toBe(new Date(2026, 9, 25, 4).getTime());
  expect(studyDayStart(new Date(2026, 9, 26, 9, 0)).getTime()).toBe(new Date(2026, 9, 26, 4).getTime());
});

it("defaults to 20 new words a day and accepts zero", () => {
  expect(readNewLimit()).toBe(DEFAULT_NEW_LIMIT);
  localStorage.setItem(NEW_LIMIT_KEY, "0");
  expect(readNewLimit()).toBe(0);
  localStorage.setItem(NEW_LIMIT_KEY, "-2");
  expect(readNewLimit()).toBe(DEFAULT_NEW_LIMIT);
});

it("falls back to what this device counted when the server can't be asked", async () => {
  localStorage.setItem(NEW_LIMIT_KEY, "5");
  noteNewStarted(); noteNewStarted();
  expect(await newCardAllowance()).toEqual({ limit: 5, started: 2, allowance: 3 });
});
