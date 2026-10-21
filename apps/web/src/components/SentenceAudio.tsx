import { useEffect, useRef, useState } from "react";
import type { FeedCard } from "@/lib/feedCards";

export default function SentenceAudio({ card, enabled }: { card: Pick<FeedCard, "audio" | "language">; enabled: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = audio.current;
    const stop = () => {
      request.current++;
      el?.pause();
      if (el) el.currentTime = 0;
      setSpeaking(false);
      setLoading(false);
    };
    const visibility = () => { if (document.hidden) stop(); };
    const otherRecording = (event: Event) => {
      if ((event as CustomEvent).detail !== el) stop();
    };
    if (!enabled) stop();
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("schwanki-demo-audio", otherRecording);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("schwanki-demo-audio", otherRecording);
    };
  }, [enabled]);

  async function toggle() {
    const el = audio.current;
    if (!el || !enabled) return;
    if (speaking) {
      request.current++;
      el.pause();
      setSpeaking(false);
      return;
    }
    const version = ++request.current;
    document.dispatchEvent(new CustomEvent("schwanki-demo-audio", { detail: el }));
    setFailed(false);
    setLoading(true);
    el.currentTime = 0;
    try {
      // A failed media resource needs a fresh load before retrying.
      if (el.error) el.load();
      await el.play();
    } catch {
      if (version === request.current) setFailed(true);
    } finally {
      if (version === request.current) setLoading(false);
    }
  }

  return <>
    <audio ref={audio} src={card.audio} preload="none"
      onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)}
      onError={() => { setFailed(true); setSpeaking(false); setLoading(false); }} />
    {enabled && <div className="demo-sentence-audio">
      <button type="button" onClick={() => void toggle()} disabled={loading}
        aria-label={`${speaking ? "Pause" : "Play"} ${card.language} sentence`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {speaking ? <><path d="M8 5v14M16 5v14" /></> : <><path d="m11 5-6 4H2v6h3l6 4z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>}
        </svg>
        {loading ? "Loading audio…" : speaking ? "Pause sentence" : "Hear the sentence"}
      </button>
      {failed && <p role="status">Couldn’t play the audio. Tap to try again.</p>}
    </div>}
  </>;
}

