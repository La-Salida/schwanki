import type { Provider } from "@schwanki/mnemonic";

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

/** Trim + validate a client-supplied model slug; null = invalid/reject with 400. */
export function normalizeModel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._:\/-]{0,99}$/.test(m) ? m : null;
}
