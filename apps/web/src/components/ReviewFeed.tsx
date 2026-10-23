import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type MutableRefObject } from "react";
import type { DueCard, ReviewRating, SchwankiCard } from "@schwanki/core";
import { api } from "@/lib/supabase";
import { loadCardMedia, type LoadedMedia } from "@/lib/mnemonic";
import { frontRanges } from "@/lib/highlight";
import { dragHint, feedAction } from "@/lib/feedGesture";
import { CardEditor } from "./CardEditor";
import { saveManualMedia } from "@/lib/manualMedia";
import { shownOn, useReviewDisplay, type DisplayField, type ReviewDisplay } from "@/lib/reviewDisplay";
import { ReviewDisplaySettings } from "./ReviewDisplaySettings";
import { useDialog } from "@/lib/useDialog";
import { MemoryAidPanel } from "./MemoryAidPanel";

// Keep signed media within this review session, including the next card's preload.
type MediaCache = Map<string, Promise<LoadedMedia>>;
function cardMedia(mediaCache: MediaCache, cardId: string): Promise<LoadedMedia> {
  let p = mediaCache.get(cardId);
  if (!p) {
    p = loadCardMedia(cardId).catch(() => { mediaCache.delete(cardId); return {}; });
    mediaCache.set(cardId, p);
  }
  return p;
}

const MUTE_KEY = "schwanki.feedMuted";
function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

function highlighted(text: string, ranges: Array<[number, number]>): ReactNode {
  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([start, end], i) => {
    if (start > pos) parts.push(text.slice(pos, start));
    parts.push(<mark key={i} className="bg-transparent font-black text-acid">{text.slice(start, end)}</mark>);
    pos = end;
  });
  parts.push(text.slice(pos));
  return parts;
}

interface Props {
  queue: DueCard[];
  done: number;
  label: string;
  /** Changes on every successful rating, so the same card can come back fresh (again-on-last-card). */
  cardKey: string;
  saveError: string | null;
  offlineNote: string | null;
  onRate: (rating: ReviewRating) => void;
  onEdited: (card: SchwankiCard) => void;
  onExit: () => void;
}

interface WheelGesture { lastEvent: number; lastAction: number; distance: number; acted: boolean }

/** One card per screen; gestures reveal and rate, while the scheduler picks the order. */
export function ReviewFeed({ queue, done, label, cardKey, saveError, offlineNote, onRate, onEdited, onExit }: Props) {
  const [muted, setMuted] = useState(readMuted);
  const { display } = useReviewDisplay();
  const [displayOpen, setDisplayOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const displayButton = useRef<HTMLButtonElement>(null);
  const [mediaCache] = useState<MediaCache>(() => new Map());
  const nextId = queue[1]?.card.id;
  // Survives card changes so trackpad momentum cannot rate the next word.
  const wheelGesture = useRef<WheelGesture>({ lastEvent: -Infinity, lastAction: -Infinity, distance: 0, acted: false });

  // Warm the next card while this one is on screen.
  useEffect(() => {
    if (!nextId) return;
    void cardMedia(mediaCache, nextId).then((m) => { if (m.imageUrl) new Image().src = m.imageUrl; });
  }, [mediaCache, nextId]);

  // The feed owns the whole screen: stop the page behind it from bouncing, and keep the
  // hidden navigation out of the tab order so keyboard and switch users land in the feed.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overscrollBehavior;
    const overflow = document.body.style.overflow;
    html.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    const covered = [...document.querySelectorAll<HTMLElement>("body header")].filter((el) => !el.inert);
    covered.forEach((el) => { el.inert = true; });
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      html.style.overscrollBehavior = before;
      document.body.style.overflow = overflow;
      covered.forEach((el) => { el.inert = false; });
    };
  }, []);

  function toggleMute() {
    setMuted((m) => {
      try { localStorage.setItem(MUTE_KEY, m ? "0" : "1"); } catch { /* private mode */ }
      return !m;
    });
  }

  const total = queue.length + done;
  return (
    <>
    <div className="review-feed" role="region" aria-label={`Review: ${label}`}>
      <div className="feed-progress" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      <div className="feed-topbar" inert={displayOpen || panelOpen}>
        <button ref={closeRef} onClick={onExit} className="feed-chip" aria-label="Back to today">✕</button>
        <p className="min-w-0 truncate text-sm font-bold text-cream/80">{label}</p>
        <p className="ml-auto shrink-0 text-sm font-bold text-cream/80" aria-live="polite">
          <span className="sr-only">{queue.length} cards remaining</span>
        </p>
        <button ref={displayButton} onClick={() => setDisplayOpen(true)} className="feed-chip" aria-label="Review display" title="Review display">⚙</button>
      </div>
      {saveError && <p role="alert" className="feed-toast bg-beak">{saveError}</p>}
      {!saveError && offlineNote && <p role="status" className="feed-toast bg-ink/80">{offlineNote}</p>}
      <FeedCard key={cardKey + JSON.stringify(display)} due={queue[0]!} muted={muted} onToggleMute={toggleMute} onRate={onRate} onEdited={onEdited} wheelGesture={wheelGesture}
        display={display} paused={displayOpen} onPanelChange={setPanelOpen} mediaCache={mediaCache} />
    </div>
    {displayOpen && <DisplayDialog onClose={() => setDisplayOpen(false)} returnFocus={displayButton} />}
    </>
  );
}

function DisplayDialog({ onClose, returnFocus }: { onClose: () => void; returnFocus: RefObject<HTMLElement | null> }) {
  const ref = useDialog(onClose, returnFocus);
  return <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50 p-3" role="dialog" aria-modal="true" aria-label="Review display">
    <div ref={ref} tabIndex={-1} className="dialog-panel space-y-4">
      <div className="flex justify-end"><button onClick={onClose} className="secondary-button">Done</button></div>
      <ReviewDisplaySettings />
    </div>
  </div>;
}

function FeedCard({ due, muted, onToggleMute, onRate, onEdited, wheelGesture, display, paused, onPanelChange, mediaCache }: {
  due: DueCard; muted: boolean; onToggleMute: () => void; onRate: (r: ReviewRating) => void; onEdited: (card: SchwankiCard) => void;
  wheelGesture: MutableRefObject<WheelGesture>;
  display: ReviewDisplay; paused: boolean; onPanelChange: (open: boolean) => void;
  mediaCache: MediaCache;
}) {
  const card = due.card;
  const [revealed, setRevealed] = useState(false);
  const [media, setMedia] = useState<LoadedMedia | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [sheet, setSheet] = useState<"none" | "memorable" | "edit">("none");
  const start = useRef<{ x: number; y: number; lastY: number; t: number; id: number; body: HTMLElement | null; scrolling: boolean } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);
  const surface = useRef<HTMLDivElement>(null);
  const memoryButton = useRef<HTMLButtonElement>(null);
  const visible = (field: DisplayField) => shownOn(display.fields[field], revealed);
  const audioVisible = visible("audio");
  useEffect(() => {
    onPanelChange(sheet !== "none");
    return () => onPanelChange(false);
  }, [sheet, onPanelChange]);

  useEffect(() => {
    let live = true;
    void cardMedia(mediaCache, card.id).then((m) => {
      if (!live) return;
      setMedia(m);
    });
    return () => { live = false; };
  }, [card.id, mediaVersion, mediaCache]);

  const play = useCallback(() => {
    if (!audio.current) return;
    audio.current.currentTime = 0;
    void audio.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, []);

  useEffect(() => {
    const player = audio.current;
    if (audioVisible && display.autoplay && !muted && !paused && sheet === "none") play();
    else player?.pause();
    return () => player?.pause();
  }, [audioVisible, display.autoplay, muted, paused, sheet, media?.audioUrl, play]);

  function reveal() {
    setRevealed(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sheet !== "none" || paused || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, a, select")) return;
      if (e.target instanceof HTMLElement && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
      if (!revealed && (e.key === " " || e.key === "Enter" || e.key === "ArrowUp")) { e.preventDefault(); reveal(); return; }
      if (!revealed) return;
      const byKey: Record<string, ReviewRating> = { "1": "again", "2": "hard", "3": "good", "4": "easy", ArrowUp: "good", ArrowLeft: "again", ArrowRight: "easy" };
      const r = byKey[e.key];
      if (r) { e.preventDefault(); onRate(r); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const el = surface.current;
    if (!el || sheet !== "none" || paused) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const body = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>(".feed-body") : null;
      const gesture = wheelGesture.current;
      const now = performance.now();
      if (now - gesture.lastEvent > 220 && now - gesture.lastAction > 650) {
        gesture.distance = 0;
        gesture.acted = false;
      }
      gesture.lastEvent = now;
      if (body && ((e.deltaY > 0 && body.scrollTop + body.clientHeight < body.scrollHeight - 1) || (e.deltaY < 0 && body.scrollTop > 0))) {
        // Let the text scroll, but consume this gesture through its momentum tail.
        gesture.acted = true;
        return;
      }
      e.preventDefault();
      if (gesture.acted || e.deltaY <= 0) return;
      gesture.distance += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (gesture.distance < 80) return;
      gesture.acted = true;
      gesture.lastAction = now;
      if (revealed) onRate("good");
      else reveal();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function onPointerDown(e: ReactPointerEvent) {
    if (sheet !== "none" || paused || (e.target as HTMLElement).closest("button, a")) return;
    const body = (e.target as HTMLElement).closest<HTMLElement>(".feed-body");
    start.current = { x: e.clientX, y: e.clientY, lastY: e.clientY, t: performance.now(), id: e.pointerId, body, scrolling: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    const step = e.clientY - s.lastY;
    s.lastY = e.clientY;
    if (s.body && (s.scrolling || (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) &&
      ((step < 0 && s.body.scrollTop + s.body.clientHeight < s.body.scrollHeight - 1) || (step > 0 && s.body.scrollTop > 0))))) {
      s.scrolling = true;
      s.body.scrollTop -= step;
      setDrag(null);
      return;
    }
    setDrag({ dx: e.clientX - s.x, dy: e.clientY - s.y });
  }
  function onPointerUp(e: ReactPointerEvent) {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s || s.id !== e.pointerId || s.scrolling) return;
    const action = feedAction(e.clientX - s.x, e.clientY - s.y, performance.now() - s.t, revealed);
    if (action.kind === "reveal") reveal();
    else if (action.kind === "rate") onRate(action.rating);
  }

  if (sheet === "edit") {
    return (
      <div className="feed-sheet-page">
        <CardEditor id={card.id} kind="card"
          initial={{ front: card.front, back: card.back, reading: card.reading ?? "", exampleSentence: card.exampleSentence ?? "" }}
          onSave={async (edits, mediaEdits) => {
            await api.updateCard(card.id, edits);
            await saveManualMedia(card.id, mediaEdits);
            mediaCache.delete(card.id); setMediaVersion(n => n + 1);
            onEdited({ ...card, ...edits }); setSheet("none");
          }}
          onCancel={() => setSheet("none")} />
      </div>
    );
  }

  // Follow the finger: up for "next", sideways for forgot/easy. Downward drags barely move.
  const dx = drag && revealed ? drag.dx : 0;
  const dy = drag ? Math.min(drag.dy, 0) + Math.max(drag.dy, 0) * 0.15 : 0;
  const hint = drag ? dragHint(drag.dx, drag.dy, revealed) : null;
  const ranges = media?.sentence ? frontRanges(media.sentence.text, card.front) : [];
  const hasMedia = !!(media && (media.imageUrl || media.audioUrl || media.sentence));
  const sentence = media?.sentence?.text ?? card.exampleSentence;
  const hasVisibleContent = (visible("word") && card.front) || (visible("reading") && card.reading)
    || (visible("meaning") && card.back) || (visible("sentence") && sentence)
    || (visible("translation") && media?.sentence?.translation) || (visible("image") && media?.imageUrl)
    || (audioVisible && media?.audioUrl);

  return (
    <div ref={surface} className={`feed-card ${drag ? "" : "feed-card-settle"} ${sheet === "memorable" ? "feed-card-with-panel" : ""}`}
      style={{ transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${dx / 40}deg)` }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; setDrag(null); }}>
      {visible("image") && media?.imageUrl && <img src={media.imageUrl} alt="" aria-hidden="true" className="feed-image" />}
      <div className="feed-shade" aria-hidden="true" />

      <div className="feed-body" inert={sheet !== "none" || paused}>
        <p className="feed-language">{card.language.toUpperCase()} · YOUR VOCABULARY</p>
        {visible("word") && <p lang={card.language} className="feed-word font-black tracking-tight">{card.front}</p>}
        {visible("reading") && card.reading && <p className="mt-1 text-xl text-cream/80">{card.reading}</p>}
        <div className="mt-4 space-y-2">
          {visible("meaning") && <p className="text-2xl font-bold">{card.back}</p>}
          {visible("sentence") && sentence && <p lang={card.language} className="text-lg font-bold leading-snug">{highlighted(sentence, ranges)}</p>}
          {visible("translation") && media?.sentence?.translation && <p className="text-sm text-cream/70">{media.sentence.translation}</p>}
        </div>
        {audioVisible && media?.audioUrl && <div className="feed-audio-prompt">
          <button onClick={play} className="feed-audio-button" aria-label="Play audio">▶ <span>{visible("word") ? "Play audio" : "Listen, then recall"}</span></button>
          {audioBlocked && <p role="status" className="text-sm">Audio couldn’t play automatically. Tap Play audio to listen.</p>}
        </div>}
        {!hasVisibleContent && <p role="status" className="mt-4 text-sm text-cream/80">{media === null ? "Loading your cue…" : "No content for this display choice on this card. Reveal the answer or change Review display."}</p>}
        {!revealed && <button onClick={reveal} className="feed-reveal" aria-label={visible("word") ? `Show meaning of ${card.front}` : "Reveal answer"}>↑ Reveal the answer <span>Tap, swipe up or scroll</span></button>}
      </div>

      {audioVisible && media?.audioUrl && <audio ref={audio} src={media.audioUrl} preload="auto" />}

      {revealed && (
        <div className="feed-rail" inert={sheet !== "none" || paused}>
          <button onClick={onToggleMute} className="feed-rail-button" aria-label={muted ? "Turn autoplay sound on" : "Turn autoplay sound off"} aria-pressed={muted}>
            {muted ? "🔇" : "🔊"}
          </button>
          <button ref={memoryButton} onClick={() => setSheet("memorable")} className="feed-rail-button" aria-label={hasMedia ? "Make it more memorable" : "Make it memorable"}>✨</button>
          <button onClick={() => setSheet("edit")} className="feed-rail-button" aria-label="Edit card">✎</button>
        </div>
      )}

      <div className="feed-ratings" role="group" aria-label="How well did you know it?" inert={sheet !== "none" || paused}>
        <p className="feed-scroll-hint">{revealed ? "↑ Swipe up or scroll for Got it · 1–4 to rate" : "Recall it first. Your next word can wait."}</p>
        <fieldset disabled={!revealed || sheet !== "none" || paused} className="contents">
          <button onClick={() => onRate("again")} className="feed-rate">← Forgot</button>
          <button onClick={() => onRate("hard")} className="feed-rate">Hard</button>
          <button onClick={() => onRate("good")} className="feed-rate feed-rate-main">↑ Got it</button>
          <button onClick={() => onRate("easy")} className="feed-rate">Easy →</button>
        </fieldset>
      </div>

      {hint && <p className="feed-hint" aria-hidden="true">{hint}</p>}

      {sheet === "memorable" && (
        <MemoryAidPanel card={card} hasMedia={hasMedia} onClose={() => setSheet("none")} returnFocus={memoryButton}
          onGenerated={() => { mediaCache.delete(card.id); setMediaVersion((n) => n + 1); }} />
      )}
    </div>
  );
}
