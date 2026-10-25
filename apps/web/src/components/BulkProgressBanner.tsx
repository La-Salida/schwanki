import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Provider } from "@schwanki/mnemonic";
import { api } from "@/lib/supabase";
import {
  cancelBulk, clearPreviewRest, enqueueBulk, estimateBulk, loadPreviewRest, pollRunDetail, savePreviewRest,
  type PreviewRest, type RunCard, type RunDetail,
} from "@/lib/bulk";
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
 *  once the queue drains the panel keeps the final tally until dismissed.
 *  A preview run (first few cards only) ends with the pictures shown large and
 *  the offer to make the cards that were held back.
 *  `compact`: one status line linking to the full panel on Decks & notes (the Review tab uses it). */
export function BulkProgressBanner({ compact = false }: { compact?: boolean }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [rest, setRest] = useState<PreviewRest | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
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
    setRest((next && loadPreviewRest(next.startedAt)) ?? null);
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

  /** Queue the cards a preview held back. Only the cards that did not get queued
   *  stay stashed, so a retry after a partial failure never queues (and bills) a
   *  card twice. */
  async function makeTheRest() {
    if (!rest) return;
    setContinuing(true);
    setContinueError(null);
    const enqueued = await enqueueBulk(rest.rest);
    if (enqueued === rest.rest.length) {
      clearPreviewRest();
      setRest(null);
      setOpen(null);
      await refresh();
    } else {
      const left = rest.rest.slice(enqueued);
      if (enqueued > 0) {
        savePreviewRest(left, rest.queuedAt);
        setRest({ ...rest, rest: left });
      }
      setContinueError(enqueued > 0
        ? `Only ${enqueued} of ${rest.rest.length} cards got queued. Press the button again to queue the other ${left.length}.`
        : "Couldn't queue the rest. Try again, or sign out and back in if it keeps failing.");
    }
    setContinuing(false);
  }

  function skipTheRest() {
    clearPreviewRest();
    setRest(null);
  }

  if (!run || run.startedAt === dismissedAt) return null;
  const { progress, total } = run;
  const waiting = progress.queued + progress.active;
  const finishedCount = progress.done + progress.failed;
  const active = waiting > 0;
  const pct = total > 0 ? Math.round((finishedCount / total) * 100) : 0;
  const previewing = rest !== null;
  // A preview is for looking at, so its list starts open.
  const listOpen = open ?? previewing;
  const listed = showAll ? run.finished : run.finished.slice(0, LIST_PREVIEW);
  const previewPictures = previewing ? run.finished.filter((c) => c.status === "done" && c.imagePath) : [];
  const restCredits = rest ? estimateBulk(rest.rest, providers.current ?? []).credits : 0;

  if (compact) {
    // A finished run only needs a look when a preview is waiting on a decision.
    if (!active && !previewing) return null;
    return (
      <Link to="/sources" className="run-line" aria-label={`${previewing && !active ? "Preview finished, decide on the rest" : `Making memory aids, ${finishedCount} of ${total} cards`}. Open Decks & notes`}>
        <span className="min-w-0 flex-1">
          <span className="font-bold">{previewing && !active ? "Preview finished" : "Making memory aids"}</span>
          <span className="text-ink/60"> · {finishedCount} of {total}{active && run.minutesLeft !== null ? ` · about ${run.minutesLeft} min left` : previewing && !active ? " · decide on the rest" : ""}</span>
          {active && <span className="run-bar mt-2 block" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
        </span>
        <span aria-hidden="true" className="font-black">→</span>
      </Link>
    );
  }

  return (
    <section aria-labelledby="run-heading" className="run-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p id="run-heading" className="app-eyebrow">
            {previewing ? (active ? "Previewing a few first" : "Preview finished") : active ? "Making memory aids" : "Memory aids finished"}
          </p>
          <p role="status" className="text-lg font-black tracking-tight">
            {finishedCount} of {total} cards
            {progress.failed > 0 && <span className="text-beak"> · {progress.failed} failed</span>}
            {active && run.minutesLeft !== null && <span className="font-bold text-ink/50"> · about {run.minutesLeft} min left</span>}
          </p>
          {previewing && active && rest && (
            <p className="text-sm text-ink/50">The other {rest.rest.length} cards wait until you've seen these.</p>
          )}
        </div>
        {active ? (
          <button onClick={() => void stop()} disabled={stopping} className="secondary-button">
            {stopping ? "Stopping…" : "Stop"}
          </button>
        ) : (
          <button onClick={() => { skipTheRest(); setDismissedAt(run.startedAt); }} className="secondary-button">Dismiss</button>
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

      {previewPictures.length > 0 && (
        <ul className="run-preview" aria-label="Preview pictures">
          {previewPictures.map((c) => <PreviewPicture key={c.jobId} card={c} />)}
        </ul>
      )}

      {previewing && !active && rest && (
        <div className="run-continue">
          <p className="font-bold">Happy with the look?</p>
          <p className="text-sm text-ink/50">
            The other {rest.rest.length} {rest.rest.length === 1 ? "card" : "cards"} will be made the same way
            {restCredits > 0 ? ` for up to ${credits(restCredits)}` : " at no credit cost"}. Not happy? Change your models in Settings first, then come back.
          </p>
          {continueError && <p role="alert" className="text-sm font-bold text-beak">{continueError}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void makeTheRest()} disabled={continuing} className="primary-button">
              {continuing ? "Queueing…" : `Make the other ${rest.rest.length} ${rest.rest.length === 1 ? "card" : "cards"}`}
            </button>
            <button onClick={skipTheRest} disabled={continuing} className="secondary-button">Not now</button>
          </div>
        </div>
      )}

      <dl className="run-credits">
        <div><dt>Spent this run</dt><dd>{credits(run.spent)}</dd></div>
        {active && <div><dt>Still to come</dt><dd>up to {credits(run.remainingCredits)}</dd></div>}
        <div><dt>How it's charged</dt><dd>Sentences are free. A picture, audio or both cost 1 credit per card. Your own provider keys cost no credits, and a part that fails isn't charged.</dd></div>
      </dl>

      {run.finished.length > 0 && (
        <div>
          <button onClick={() => setOpen(!listOpen)} aria-expanded={listOpen} className="run-toggle">
            {listOpen ? "Hide" : "Show"} what's been made ({run.finished.length})
          </button>
          {listOpen && (
            <ul className="run-list">
              {listed.map((c) => <RunRow key={c.jobId} card={c} />)}
            </ul>
          )}
          {listOpen && run.finished.length > LIST_PREVIEW && (
            <button onClick={() => setShowAll((s) => !s)} className="run-toggle">
              {showAll ? "Show fewer" : `Show all ${run.finished.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function useSignedImage(path: string | null): string | null {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let dead = false;
    void api.signedMediaUrl(path).then((url) => { if (!dead) setImage(url); }).catch(() => undefined);
    return () => { dead = true; };
  }, [path]);
  return image;
}

/** A preview card's picture, large enough to judge the style. */
function PreviewPicture({ card }: { card: RunCard }) {
  const image = useSignedImage(card.imagePath);
  return (
    <li>
      <figure className="run-preview-pic">
        {image ? <img src={image} alt={`Picture for ${card.front}`} /> : <span className="run-thumb" aria-hidden="true" />}
        <figcaption className="text-sm font-bold">{card.front}</figcaption>
      </figure>
    </li>
  );
}

function RunRow({ card }: { card: RunCard }) {
  const image = useSignedImage(card.imagePath);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

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
