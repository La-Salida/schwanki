import { api } from "./supabase";

export interface ManualMediaEdits {
  example?: { text: string; translation: string };
  image?: File | null;
  audio?: File | null;
}

export function validateCardFile(kind: "image" | "audio", file: File): void {
  const types = kind === "image"
    ? ["image/jpeg", "image/png", "image/webp", "image/gif"]
    : ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac", "audio/flac"];
  if (!types.includes(file.type)) throw new Error(kind === "image" ? "Choose a JPG, PNG, WebP or GIF image." : "Choose an MP3, WAV, Ogg, WebM, M4A, AAC or FLAC recording.");
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Choose a non-empty file smaller than 20 MB.");
}

/** Run before the review screen closes, so failures leave the learner's draft intact. */
export async function saveManualMedia(cardId: string, edits?: ManualMediaEdits): Promise<void> {
  if (!edits) return;
  if (edits.example) await api.saveCardExample(cardId, edits.example.text, edits.example.translation);
  for (const kind of ["image", "audio"] as const) {
    const file = edits[kind];
    if (file === null) await api.removeCardMedia(cardId, kind);
    else if (file) {
      validateCardFile(kind, file);
      await api.replaceCardFile(cardId, kind, { name: file.name, body: file, contentType: file.type });
    }
  }
}
