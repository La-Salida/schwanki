import { useEffect, useState } from "react";
import { cancelBulk, pollBulk, type BulkProgress } from "@/lib/bulk";

const ACTIVE_MS = 5_000;
const IDLE_MS = 15_000; // quiet back-off so a freshly enqueued run still shows up soon

/** Background bulk-generation progress on the Review overview: polls the
 *  bulk_jobs queue every 5s while anything is pending/running (15s when idle).
 *  Stop cancels the still-pending jobs (RLS-scoped to the caller); once the
 *  queue drains the banner shows the final tally until dismissed. */
export function BulkProgressBanner() {
  const [active, setActive] = useState<BulkProgress | null>(null);
  const [finished, setFinished] = useState<BulkProgress | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let dead = false;
    let timer: number | undefined;
    async function tick() {
      const p = await pollBulk().catch(() => null);
      if (dead) return;
      if (p && p.queued + p.active > 0) {
        setActive(p);
        setFinished(null);
        timer = window.setTimeout(() => void tick(), ACTIVE_MS);
      } else {
        setActive(null);
        if (p && (p.done > 0 || p.failed > 0)) setFinished(p); // drained → final tally
        timer = window.setTimeout(() => void tick(), IDLE_MS);
      }
    }
    void tick();
    return () => { dead = true; window.clearTimeout(timer); };
  }, []);

  async function stop() {
    setStopping(true);
    await cancelBulk().catch(() => undefined);
    setStopping(false);
    const p = await pollBulk().catch(() => null);
    setActive(p && p.queued + p.active > 0 ? p : null);
  }

  if (active) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink/10 bg-white/70 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm font-bold">
          Generating: {active.done} done
          {active.failed > 0 && <span className="text-beak"> · {active.failed} failed</span>}
          <span className="text-ink/50"> · {active.queued + active.active} queued</span>
        </p>
        <button onClick={() => void stop()} disabled={stopping}
          className="rounded-lg border-2 border-ink/15 px-3 py-1 text-sm font-bold disabled:opacity-40">
          {stopping ? "Stopping…" : "Stop"}
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div role="status" className="notice flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold">
          Generation finished: {finished.done} succeeded
          {finished.failed > 0 && <span className="text-beak">, {finished.failed} failed (run again to retry just those)</span>}
        </p>
        <button onClick={() => setFinished(null)}
          className="rounded-lg px-2 py-1 text-sm text-ink/50 hover:bg-ink/5">dismiss</button>
      </div>
    );
  }

  return null;
}
