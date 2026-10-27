import { useEffect, useState } from "react";

export const REVIEW_DISPLAY_KEY = "schwanki.reviewDisplay.v2";
// v1 showed the reading (pinyin, kana) on the prompt, which gives the answer away.
const LEGACY_KEY = "schwanki.reviewDisplay.v1";
const CHANGE_EVENT = "schwanki:review-display";
export const DISPLAY_FIELDS = ["word", "reading", "meaning", "sentence", "translation", "image", "audio"] as const;
export type DisplayField = typeof DISPLAY_FIELDS[number];
export type DisplaySide = "prompt" | "answer" | "both" | "hidden";
export interface ReviewDisplay {
  fields: Record<DisplayField, DisplaySide>;
  autoplay: boolean;
}

export const DEFAULT_REVIEW_DISPLAY: ReviewDisplay = {
  fields: { word: "both", reading: "answer", meaning: "answer", sentence: "answer", translation: "answer", image: "both", audio: "answer" },
  autoplay: true,
};

const answerFields: Record<DisplayField, DisplaySide> = {
  word: "answer", reading: "answer", meaning: "answer", sentence: "answer", translation: "answer", image: "answer", audio: "answer",
};

export const REVIEW_PRESETS: Array<{ id: string; label: string; display: ReviewDisplay }> = [
  { id: "scene", label: "Word + image first", display: DEFAULT_REVIEW_DISPLAY },
  { id: "word", label: "Word first", display: { fields: { ...answerFields, word: "both" }, autoplay: true } },
  { id: "image", label: "Image first", display: { fields: { ...answerFields, image: "both" }, autoplay: true } },
  { id: "audio", label: "Audio first", display: { fields: { ...answerFields, audio: "both" }, autoplay: true } },
  { id: "meaning", label: "Meaning first", display: { fields: { ...answerFields, meaning: "both" }, autoplay: true } },
];

export function shownOn(side: DisplaySide, revealed: boolean): boolean {
  return side === "both" || side === (revealed ? "answer" : "prompt");
}

export function readReviewDisplay(): ReviewDisplay {
  try {
    const current = localStorage.getItem(REVIEW_DISPLAY_KEY);
    const value: unknown = JSON.parse(current ?? localStorage.getItem(LEGACY_KEY) ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_REVIEW_DISPLAY;
    const stored = value as { fields?: unknown; autoplay?: unknown };
    const fields = stored.fields && typeof stored.fields === "object" ? { ...stored.fields as Record<string, unknown> } : {};
    if (current === null && fields.reading === "both") fields.reading = "answer";
    return {
      fields: Object.fromEntries(DISPLAY_FIELDS.map(field => {
        const side = fields[field];
        return [field, side === "prompt" || side === "answer" || side === "both" || side === "hidden" ? side : DEFAULT_REVIEW_DISPLAY.fields[field]];
      })) as Record<DisplayField, DisplaySide>,
      autoplay: typeof stored.autoplay === "boolean" ? stored.autoplay : true,
    };
  } catch { return DEFAULT_REVIEW_DISPLAY; }
}

export function useReviewDisplay() {
  const [display, setDisplay] = useState(readReviewDisplay);
  useEffect(() => {
    const local = (event: Event) => setDisplay((event as CustomEvent<ReviewDisplay>).detail);
    const remote = (event: StorageEvent) => { if (event.key === REVIEW_DISPLAY_KEY || event.key === null) setDisplay(readReviewDisplay()); };
    window.addEventListener(CHANGE_EVENT, local);
    window.addEventListener("storage", remote);
    return () => { window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener("storage", remote); };
  }, []);

  function update(next: ReviewDisplay): boolean {
    let saved = true;
    try { localStorage.setItem(REVIEW_DISPLAY_KEY, JSON.stringify(next)); } catch { saved = false; }
    setDisplay(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
    return saved;
  }
  return { display, update };
}
