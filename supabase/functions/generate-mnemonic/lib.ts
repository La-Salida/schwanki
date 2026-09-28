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
};
