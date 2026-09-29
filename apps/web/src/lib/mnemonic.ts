import type { CardMedia, MediaKind } from "@schwanki/core";
import { api, supabase } from "./supabase";

export interface GenerateResult {
  generationId: string;
  sentence: { text: string; translation: string };
  imagePath?: string;
  audioPath?: string;
  failures: MediaKind[];
  billed: boolean;
  balance?: number;
}

export interface ModelChoices {
  sentence?: string;
  image?: string;
  audio?: string;
}

export async function generateMnemonic(cardId: string, hook?: string, models?: ModelChoices): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("generate-mnemonic", {
    body: {
      cardId,
      hook,
      models: {
        sentence: models?.sentence || undefined, // never send empty strings — edge 400s
        image: models?.image || undefined,
        audio: models?.audio || undefined,
      },
    },
  });
  if (error) {
    const body = (error as { context?: Response }).context;
    const parsed = body ? await body.json().catch(() => null) : null;
    throw new Error(parsed?.error ?? error.message);
  }
  return data as GenerateResult;
}

export interface LoadedMedia {
  sentence?: { text: string; translation: string };
  imageUrl?: string;
  audioUrl?: string;
  hook?: string;
}

export async function loadCardMedia(cardId: string): Promise<LoadedMedia> {
  const rows = await api.listCardMedia([cardId]);
  return rowsToMedia(rows);
}

export async function rowsToMedia(rows: CardMedia[]): Promise<LoadedMedia> {
  const out: LoadedMedia = {};
  for (const row of rows) {
    if (row.kind === "sentence" && row.content) out.sentence = JSON.parse(row.content);
    if (row.kind === "image" && row.storagePath) out.imageUrl = await api.signedMediaUrl(row.storagePath);
    if (row.kind === "audio" && row.storagePath) out.audioUrl = await api.signedMediaUrl(row.storagePath);
    if (row.promptUsed) out.hook = row.promptUsed;
  }
  return out;
}
