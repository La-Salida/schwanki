/**
 * The feed's sound effects, synthesized on the spot with Web Audio so there is nothing to download
 * and nothing that can 404. Short, soft and tonal, in the spirit of Duolingo's chimes:
 * a rising two-note "got it", a low "forgot" thud, a run-of-notes for milestones and the finish.
 * They follow the feed's one mute toggle and never play under reduced motion.
 */
export type Sfx = "knew" | "forgot" | "milestone" | "finish" | "streak";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** Call from a user gesture (a tap or a swipe) so iOS lets the context start. */
export function primeSfx(): void { audio(); }

interface Note { freq: number; at: number; dur: number; gain?: number; type?: OscillatorType }

function play(notes: Note[], master = 0.5) {
  const c = audio();
  if (!c) return;
  const out = c.createGain();
  out.gain.value = master;
  out.connect(c.destination);
  const t0 = c.currentTime + 0.01;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    const peak = n.gain ?? 0.6;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(out);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
}

// Pitches: C major, so every effect sits in the same key and chains sound like one instrument.
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G4 = 392, C4 = 261.63;

const SOUNDS: Record<Sfx, () => void> = {
  knew: () => play([
    { freq: G5, at: 0, dur: 0.14, type: "triangle" },
    { freq: C6, at: 0.09, dur: 0.26, type: "triangle" },
  ], 0.35),
  forgot: () => play([
    { freq: 196, at: 0, dur: 0.22, type: "triangle", gain: 0.7 },
    { freq: 147, at: 0.1, dur: 0.3, type: "triangle", gain: 0.5 },
  ], 0.35),
  milestone: () => play([
    { freq: C5, at: 0, dur: 0.18, type: "triangle" },
    { freq: E5, at: 0.09, dur: 0.18, type: "triangle" },
    { freq: G5, at: 0.18, dur: 0.18, type: "triangle" },
    { freq: C6, at: 0.27, dur: 0.5, type: "triangle" },
    { freq: E6, at: 0.27, dur: 0.5, type: "sine", gain: 0.3 },
  ], 0.4),
  finish: () => play([
    { freq: C5, at: 0, dur: 0.3 },
    { freq: E5, at: 0.12, dur: 0.3 },
    { freq: G5, at: 0.24, dur: 0.3 },
    { freq: C6, at: 0.36, dur: 0.9, gain: 0.7 },
    { freq: E6, at: 0.48, dur: 0.8, gain: 0.35 },
    { freq: G4, at: 0.36, dur: 0.9, gain: 0.25, type: "triangle" },
    { freq: C4, at: 0.36, dur: 0.9, gain: 0.25, type: "triangle" },
  ], 0.4),
  streak: () => play([
    { freq: E5, at: 0, dur: 0.12, type: "triangle" },
    { freq: G5, at: 0.07, dur: 0.12, type: "triangle" },
    { freq: C6, at: 0.14, dur: 0.12, type: "triangle" },
    { freq: E6, at: 0.21, dur: 0.6, type: "triangle", gain: 0.5 },
  ], 0.4),
};

export function playSfx(name: Sfx, muted: boolean): void {
  if (muted) return;
  try { if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; } catch { /* ignore */ }
  try { SOUNDS[name](); } catch { /* audio is a bonus, never an error */ }
}
