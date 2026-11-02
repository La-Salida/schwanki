/** Pure helpers for recorded lessons, shared by lesson-recording and lesson-worker. */

export type Channel = "tab" | "microphone";

/** 1 credit per started 5 minutes recorded (YJ, 2026-11-02). A user's first lesson is free. */
export const MINUTES_PER_CREDIT = 5;
/** The free first lesson covers up to this long. Past it, the extra minutes are charged. */
export const FREE_FIRST_LESSON_MS = 60 * 60_000;
export const MAX_LESSON_MS = 2 * 60 * 60_000;
export const MAX_PART_BYTES = 50 * 1024 * 1024;

export function lessonCost(durationMs: number, firstLesson: boolean): number {
  const charged = Math.max(0, durationMs - (firstLesson ? FREE_FIRST_LESSON_MS : 0));
  return Math.ceil(charged / (MINUTES_PER_CREDIT * 60_000));
}

export interface PartInput { channel: Channel; part: number; startMs: number; durationMs: number; bytes: number; checksum: string; mimeType: string }

/** Validates the part list the extension reports. Returns an error message, or null when it is usable. */
export function checkParts(parts: unknown): string | null {
  if (!Array.isArray(parts) || parts.length === 0) return "No audio parts were sent.";
  if (parts.length > 64) return "Too many audio parts.";
  const seen = new Set<string>();
  for (const value of parts) {
    const p = value as Partial<PartInput>;
    if (p.channel !== "tab" && p.channel !== "microphone") return "Unknown audio channel.";
    if (!Number.isInteger(p.part) || p.part! < 0) return "Bad part number.";
    if (!Number.isFinite(p.startMs) || p.startMs! < 0 || !Number.isFinite(p.durationMs) || p.durationMs! < 0) return "Bad part timing.";
    if (!Number.isInteger(p.bytes) || p.bytes! <= 0 || p.bytes! > MAX_PART_BYTES) return "An audio part is empty or too large.";
    if (typeof p.checksum !== "string" || !/^[0-9a-f]{64}$/.test(p.checksum)) return "Bad part checksum.";
    if (p.mimeType !== "audio/webm" && p.mimeType !== "audio/webm;codecs=opus") return "Unsupported audio format.";
    const key = `${p.channel}/${p.part}`;
    if (seen.has(key)) return "Duplicate audio part.";
    seen.add(key);
  }
  if (!parts.some((p) => (p as PartInput).channel === "tab")) return "The lesson audio track is missing.";
  return null;
}

export function partPath(userId: string, recordingId: string, channel: Channel, part: number): string {
  return `${userId}/${recordingId}/${channel}-${part}.webm`;
}

/** One entry of ElevenLabs Scribe's `words` list. */
export interface ScribeWord { text: string; start?: number; end?: number; type?: string }
export interface Segment { channel: Channel; startMs: number; endMs: number; text: string }

const SENTENCE_END = /[.?!。？！]$/;

/** Groups word timings into utterances: split on a pause of a second or more, after a sentence
 *  end once the line has some length, or when a line passes 30 seconds. Times shift by `offsetMs`,
 *  the part's start in the lesson. */
export function segmentWords(words: ScribeWord[], channel: Channel, offsetMs: number): Segment[] {
  const segments: Segment[] = [];
  let text = "";
  let start = -1;
  let end = 0;
  const flush = () => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean && start >= 0) segments.push({ channel, startMs: Math.round(offsetMs + start * 1000), endMs: Math.round(offsetMs + end * 1000), text: clean });
    text = ""; start = -1;
  };
  for (const word of words) {
    if (word.type === "audio_event") continue;
    if (word.type === "spacing") { if (start >= 0) text += word.text; continue; }
    const wStart = word.start ?? end;
    const wEnd = word.end ?? wStart;
    if (start >= 0 && (wStart - end >= 1 || wStart - start >= 30 || (SENTENCE_END.test(text.trim()) && text.trim().length >= 12))) flush();
    if (start < 0) start = wStart;
    text += word.text;
    end = wEnd;
  }
  flush();
  return segments;
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** The transcript the card parser reads: both tracks merged in time order, one line per utterance. */
export function transcriptText(segments: Segment[]): string {
  return [...segments]
    .sort((a, b) => a.startMs - b.startMs || (a.channel === "tab" ? -1 : 1))
    .map((s) => `[${clock(s.startMs)}] ${s.channel === "tab" ? "Tutor" : "You"}: ${s.text}`)
    .join("\n");
}
