import type { Provider } from "@schwanki/mnemonic";
import type { MediaKind } from "@schwanki/core";

export const RATE_LIMIT_PER_HOUR = 30;

/** mediaRowsThisHour counts card_media rows; 3 rows = 1 generation. */
export function rateLimited(mediaRowsThisHour: number): boolean {
  return mediaRowsThisHour >= RATE_LIMIT_PER_HOUR * 3;
}

export function storagePath(userId: string, cardId: string, generationId: string, kind: "image" | "audio"): string {
  return `${userId}/${cardId}/${generationId}-${kind}.${kind === "image" ? "png" : "mp3"}`;
}

export const OUR_KEY_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  fal: "FAL_KEY",
  together: "TOGETHER_API_KEY",
  higgsfield: "HIGGSFIELD_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const MODEL_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._:\/-]{0,99}$/;

/** Trim + validate a client-supplied model slug; null = invalid/reject with 400. */
export function normalizeModel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim();
  return MODEL_SLUG.test(m) ? m : null;
}

export interface ModelsChoice { sentence?: string; image?: string; audio?: string }

const MODEL_KINDS: readonly (keyof ModelsChoice)[] = ["sentence", "image", "audio"];

/** Validate the client-supplied per-kind model map; null = reject with 400. Fields must be non-empty valid slugs. */
export function normalizeModels(raw: unknown): ModelsChoice | null {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null) return null;
  const out: ModelsChoice = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!MODEL_KINDS.includes(key as keyof ModelsChoice)) return null;
    const model = normalizeModel(value);
    if (model === null) return null;
    out[key as keyof ModelsChoice] = model;
  }
  return out;
}

const CANONICAL_KINDS = ["sentence", "image", "audio"] as const;

/**
 * Validate the client-supplied kinds array; null = reject with 400.
 * undefined → all three kinds; entries must be known kinds; the result is
 * deduped and ordered canonically (sentence → image → audio).
 */
export function normalizeKinds(raw: unknown): MediaKind[] | null {
  if (raw === undefined) return [...CANONICAL_KINDS];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const present = new Set<MediaKind>();
  for (const entry of raw) {
    if (!(CANONICAL_KINDS as readonly string[]).includes(entry as string)) return null;
    present.add(entry as MediaKind);
  }
  return CANONICAL_KINDS.filter((k) => present.has(k));
}

const VOICE_ID = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

/**
 * Optional TTS voice: an ElevenLabs voice-library ID (or premade name like "Rachel",
 * OpenAI voice like "nova"). undefined input → ""; invalid → null (reject with 400).
 */
export function normalizeVoice(raw: unknown): string | null {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return "";
  return VOICE_ID.test(v) ? v : null;
}
