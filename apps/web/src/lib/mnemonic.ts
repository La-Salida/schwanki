import type { CardMedia, MediaKind } from "@schwanki/core";
import { api, supabase } from "./supabase";

export interface GenerateResult {
  generationId: string;
  sentence: { text: string; translation: string };
  imagePath?: string;
  audioPath?: string;
  failures: MediaKind[];
  billed: boolean;
  cost: number;
  balance?: number;
}

export interface ModelChoices {
  sentence?: string;
  image?: string;
  audio?: string;
}

export interface GenerateOptions {
  hook?: string | undefined;
  models?: ModelChoices | undefined;
  /** Kinds to generate; omitted = full scene (all three). */
  kinds?: MediaKind[] | undefined;
}

export async function generateMnemonic(cardId: string, opts?: GenerateOptions): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("generate-mnemonic", {
    body: {
      cardId,
      hook: opts?.hook || undefined, // never send empty strings — edge 400s
      models: {
        sentence: opts?.models?.sentence || undefined,
        image: opts?.models?.image || undefined,
        audio: opts?.models?.audio || undefined,
      },
      kinds: opts?.kinds?.length ? opts.kinds : undefined,
    },
  });
  if (error) {
    const body = (error as { context?: Response }).context;
    const parsed = body ? await body.json().catch(() => null) : null;
    if (parsed?.error === "no_credits") {
      throw new Error("Out of credits — add your own key in Settings (free forever) or get credits.");
    }
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
