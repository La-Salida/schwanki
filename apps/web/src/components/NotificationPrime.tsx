import { useState } from "react";
import { subscribePush } from "@/lib/push";

/** Mascot sells the reminder BEFORE the OS dialog (§9.3). Shown once per device. */
export function NotificationPrime() {
  const [hour, setHour] = useState(9);
  const [done, setDone] = useState(() => localStorage.getItem("pushPrimed") === "1");
  if (done) return null;

  async function enable() {
    const ok = await subscribePush(hour);
    localStorage.setItem("pushPrimed", "1");
    setDone(true);
    if (!ok) alert("Notifications blocked. The goose will remember this.");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl p-4">
      <div className="flex items-center gap-4 rounded-3xl border-2 border-ink/10 bg-ink p-5 text-cream shadow-2xl">
        <img src="/goose.png" alt="" className="w-16" />
        <div className="flex-1">
          <p className="font-bold">I'll nag you daily. It's literally my whole job.</p>
          <div className="mt-2 flex items-center gap-2">
            <select value={hour} onChange={(e) => setHour(+e.target.value)}
              className="rounded-lg bg-cream px-2 py-1 text-ink">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            <button onClick={() => void enable()} className="rounded-lg bg-beak px-4 py-1 font-bold">Enable</button>
            <button onClick={() => { localStorage.setItem("pushPrimed", "1"); setDone(true); }}
              className="text-sm text-cream/60">no thanks</button>
          </div>
        </div>
      </div>
    </div>
  );
}
