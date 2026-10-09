import { useState } from "react";
import { subscribePush } from "@/lib/push";

/** Mascot sells the reminder BEFORE the OS dialog (§9.3). Shown once per device. */
export function NotificationPrime() {
  const [hour, setHour] = useState(9);
  const [done, setDone] = useState(() => localStorage.getItem("pushPrimed") === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done) return null;

  async function enable() {
    setBusy(true); setError(null);
    try {
      const ok = await subscribePush(hour);
      if (!ok) { setError("Reminders aren't available in this browser, or permission was denied. You can keep reviewing without them."); return; }
      localStorage.setItem("pushPrimed", "1"); setDone(true);
    } catch { setError("Couldn't enable reminders. Try again, or skip for now."); }
    finally { setBusy(false); }
  }

  return (
    <aside aria-label="Review reminders">
      <div className="flex items-start gap-4 rounded-xl bg-ink p-5 text-cream">
        <img src="/goose.png" alt="" className="hidden w-16 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">A daily nudge from the goose?</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <select aria-label="Daily reminder time" value={hour} onChange={(e) => setHour(+e.target.value)}
              className="rounded-lg bg-cream px-2 py-1 text-ink">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            <button onClick={() => void enable()} disabled={busy} className="rounded-lg bg-beak px-4 py-2 font-bold disabled:opacity-50">{busy ? "Enabling…" : "Enable reminders"}</button>
            <button onClick={() => { localStorage.setItem("pushPrimed", "1"); setDone(true); }}
              className="text-sm text-cream/60 underline">Skip for now</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
        </div>
      </div>
    </aside>
  );
}
