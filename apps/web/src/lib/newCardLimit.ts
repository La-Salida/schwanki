import { useEffect, useState } from "react";
import { api } from "@/lib/supabase";

export const NEW_LIMIT_KEY = "schwanki.newCardsPerDay.v1";
const STARTED_KEY = "schwanki.newCardsStarted.v1";
const CHANGE_EVENT = "schwanki:new-limit";
export const DEFAULT_NEW_LIMIT = 20;
const DAY_ROLLOVER_HOUR = 4; // like Anki: a late-night session still counts as the same day

/** When today's study day began: 4am local, or yesterday's 4am before that. */
export function studyDayStart(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(DAY_ROLLOVER_HOUR, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}

export function readNewLimit(): number {
  try {
    const n = Number(localStorage.getItem(NEW_LIMIT_KEY));
    return localStorage.getItem(NEW_LIMIT_KEY) !== null && Number.isInteger(n) && n >= 0 ? n : DEFAULT_NEW_LIMIT;
  } catch { return DEFAULT_NEW_LIMIT; }
}

export function useNewLimit() {
  const [limit, setLimit] = useState(readNewLimit);
  useEffect(() => {
    const sync = () => setLimit(readNewLimit());
    const remote = (e: StorageEvent) => { if (e.key === NEW_LIMIT_KEY || e.key === null) sync(); };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", remote);
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener("storage", remote); };
  }, []);
  function update(next: number): boolean {
    const value = Math.max(0, Math.min(9999, Math.round(next)));
    let saved = true;
    try { localStorage.setItem(NEW_LIMIT_KEY, String(value)); } catch { saved = false; }
    setLimit(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return saved;
  }
  return { limit, update };
}

function readStarted(): number {
  try {
    const v = JSON.parse(localStorage.getItem(STARTED_KEY) ?? "null") as { day?: string; count?: number } | null;
    return v && v.day === studyDayStart().toISOString() && typeof v.count === "number" ? v.count : 0;
  } catch { return 0; }
}

function writeStarted(count: number) {
  try { localStorage.setItem(STARTED_KEY, JSON.stringify({ day: studyDayStart().toISOString(), count })); } catch { /* private mode */ }
}

/** Remember a new card studied on this device, so an offline session still respects the limit. */
export function noteNewStarted() {
  writeStarted(readStarted() + 1);
}

/** How many more new cards today. Online it counts today's first reviews on the server
 * (call after the outbox is flushed); offline it uses what this device last knew. */
export async function newCardAllowance(): Promise<{ limit: number; started: number; allowance: number }> {
  let started = readStarted();
  try {
    if (!navigator.onLine) throw new Error("offline");
    started = await api.countNewStarted(studyDayStart());
    writeStarted(started);
  } catch { /* keep the local count */ }
  const limit = readNewLimit();
  return { limit, started, allowance: Math.max(0, limit - started) };
}
