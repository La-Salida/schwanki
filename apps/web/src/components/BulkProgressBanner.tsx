import { useEffect, useRef, useState } from "react";
import type { Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import { cancelBulk, pollRunDetail, type RunCard, type RunDetail } from "@/lib/bulk";
import { notifyCreditsChanged } from "@/lib/creditEvents";

const ACTIVE_MS = 5_000;
const IDLE_MS = 15_000; // quiet back-off so a freshly enqueued run still shows up soon
/** Finished cards listed before "Show all", so a 300-card run stays readable. */
const LIST_PREVIEW = 12;

const KIND_WORD: Record<string, string> = { sentence: "sentence", image: "picture", audio: "audio" };
const kindList = (kinds: string[]) => kinds.map((k) => KIND_WORD[k] ?? k).join(", ");
const credits = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;
const costLabel = (c: RunCard) => (c.credits === null ? "not charged" : credits(c.credits));

/** Deck generation progress on the Review overview. Polls the bulk_jobs queue
 *  every 5s while anything is pending/running (15s when idle) and shows what is
 *  being made right now, what each finished card got and cost, and the run's
 *  credit total. Stop cancels the still-pending jobs (RLS-scoped to the caller);
 *  once the queue drains the panel keeps the final tally until dismissed. */
export function BulkProgressBanner() {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const providers = useRef<Provider[] | null>(null);
  const lastFinished = useRef(-1);

  async function refresh(): Promise<RunDetail | null> {
    providers.current ??= await api.listApiKeyProviders().then((p) => p.map((x) => x.provider as Provider)).catch(() => []);
    const next = await pollRunDetail(providers.current).catch(() => null);
    const finishedCount = next ? next.progress.done + next.progress.failed : 0;
    // Each finished card may have charged credits: keep the nav balance in step.
    if (lastFinished.current >= 0 && finishedCount !== lastFinished.current) notifyCreditsChanged();
    lastFinished.current = finishedCount;
    setRun(next);
    return next;
  }

  useEffect(() => {
    let dead = false;
    let timer: number | undefined;
    async function tick() {
      const next = await refresh();
      if (dead) return;
      const active = next !== null && next.progress.queued + next.progress.active > 0;
      timer = window.setTimeout(() => void tick(), active ? ACTIVE_MS : IDLE_MS);
    }
    void tick();
    return () => { dead = true; window.clearTimeout(timer); };
    // refresh only touches refs and setters
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stop() {
    setStopping(true);
    await cancelBulk().catch(() => undefined);
    await refresh();
    setStopping(false);
  }

  if (!run || run.startedAt === dismissedAt) return null;
  const { progress, total } = run;
  const waiting = progress.queued + progress.active;
  const finishedCount = progress.done + progress.failed;
  const active = waiting > 0;
  const pct = total > 0 ? Math.round((finishedCount / total) * 100) : 0;
  const listed = showAll ? run.finished : run.finished.slice(0, LIST_PREVIEW);

  return (
    <section aria-labelledby="run-heading" className="run-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p id="run-heading" className="app-eyebrow">{active ? "Making memory aids" : "Memory aids finished"}</p>
          <p role="status" className="text-lg font-black tracking-tight">
            {finishedCount} of {total} cards
            {progress.failed > 0 && <span className="text-beak"> · {progress.failed} failed</span>}
            {active && run.minutesLeft !== null && <span className="font-bold text-ink/50"> · about {run.minutesLeft} min left</span>}
          </p>
        </div>
        {active ? (
          <button onClick={() => void stop()} disabled={stopping} className="secondary-button">
            {stopping ? "Stopping…" : "Stop"}
          </button>
        ) : (
          <button onClick={() => setDismissedAt(run.startedAt)} className="secondary-button">Dismiss</button>
        )}
      </div>

      <div className="run-bar" role="progressbar" aria-label="Cards finished" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finishedCount}>
        <span style={{ width: `${pct}%` }} />
      </div>

      {run.running.length > 0 && (
        <p className="text-sm">
          <span className="font-bold">Now making: </span>
          {run.running.map((c) => `${c.front} (${kindList(c.kinds)})`).join(", ")}
        </p>
      )}

      <dl className="run-credits">
        <div><dt>Spent this run</dt><dd>{credits(run.spent)}</dd></div>
        {active && <div><dt>Still to come</dt><dd>up to {credits(run.remainingCredits)}</dd></div>}
        <div><dt>How it's charged</dt><dd>Sentences are free. A picture, audio or both cost 1 credit per card. Your own provider keys cost no credits, and a part that fails isn't charged.</dd></div>
      </dl>

      {run.finished.length > 0 && (
        <div>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="run-toggle">
            {open ? "Hide" : "Show"} what's been made ({run.finished.length})
          </button>
          {open && (
            <ul className="run-list">
              {listed.map((c) => <RunRow key={c.jobId} card={c} />)}
            </ul>
          )}
          {open && run.finished.length > LIST_PREVIEW && (
            <button onClick={() => setShowAll((s) => !s)} className="run-toggle">
              {showAll ? "Show fewer" : `Show all ${run.finished.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function RunRow({ card }: { card: RunCard }) {
  const [image, setImage] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!card.imagePath) return;
    let dead = false;
    void api.signedMediaUrl(card.imagePath).then((url) => { if (!dead) setImage(url); }).catch(() => undefined);
    return () => { dead = true; };
  }, [card.imagePath]);
  useEffect(() => () => audio.current?.pause(), []);

  async function play() {
    if (!card.audioPath) return;
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    try {
      audio.current ??= new Audio(await api.signedMediaUrl(card.audioPath));
      audio.current.onended = () => setPlaying(false);
      await audio.current.play();
      setPlaying(true);
    } catch { setPlaying(false); }
  }

  return (
    <li className="run-row">
      <div className="run-thumb">{image ? <img src={image} alt="" /> : null}</div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{card.front}</p>
        {card.status === "failed" ? (
          <p className="text-sm text-beak">Failed: {card.error ?? "unknown error"}<span className="run-cost-inline text-ink/50"> · not charged</span></p>
        ) : (
          <>
            {card.sentence && <p className="text-sm">{card.sentence.text}</p>}
            {card.sentence?.translation && <p className="text-sm text-ink/50">{card.sentence.translation}</p>}
            <p className="text-xs text-ink/50">{kindList(card.kinds)}<span className="run-cost-inline"> · {costLabel(card)}</span></p>
          </>
        )}
      </div>
      {card.audioPath && (
        <button onClick={() => void play()} aria-label={`${playing ? "Pause" : "Play"} audio for ${card.front}`} className="run-play">
          {playing ? "❚❚" : "▶"}
        </button>
      )}
      <p className="run-cost">{costLabel(card)}</p>
    </li>
  );
}
