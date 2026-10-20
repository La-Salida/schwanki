import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { api } from "@/lib/supabase";
import { readAnkiPackage, type AnkiCollection } from "./package";
import { guessLanguage, planImport, type ImportPlan, type PlannedDeck } from "./plan";

export interface OpenedDeckFile { fileName: string; collection: AnkiCollection; plan: ImportPlan; language: string | null }

/** Read an .apkg/.colpkg in the browser; nothing is uploaded until the import starts. */
export async function openAnkiFile(file: File, now = new Date()): Promise<OpenedDeckFile> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const collection = readAnkiPackage(new Uint8Array(await file.arrayBuffer()), SQL);
  const plan = planImport(collection, now);
  const language = guessLanguage(collection.cards.map((c) => c.note.front));
  return { fileName: file.name, collection, plan, language };
}

export interface ImportProgress { phase: "cards" | "media"; done: number; total: number }
export interface ImportResult { created: number; duplicates: number; mediaFailed: number }

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", webm: "audio/webm", opus: "audio/ogg", flac: "audio/flac",
};
const mimeFor = (name: string) => MIME[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""];
const MEDIA_BATCH = 24;
const UPLOADS_AT_ONCE = 4;

/** Import one deck as a source: cards with their schedules, then the pictures and audio they use. */
export async function importDeck(
  opened: OpenedDeckFile, deck: PlannedDeck, language: string, onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const source = await api.addSource({ type: "anki_deck", externalRef: `anki:${opened.fileName}#${deck.name}`, label: deck.name, language });
  const items = deck.cards.map(({ card, state }) => ({ ...card.note, state }));
  const total = items.length;
  onProgress({ phase: "cards", done: 0, total });
  const ids = await api.importCards(source.id, language, items, (done) => onProgress({ phase: "cards", done, total }));
  const created = ids.filter(Boolean).length;

  const uploads: Array<{ cardId: string; kind: "image" | "audio"; name: string }> = [];
  deck.cards.forEach(({ card }, i) => {
    const cardId = ids[i];
    if (!cardId) return;
    if (card.note.image && mimeFor(card.note.image)?.startsWith("image/")) uploads.push({ cardId, kind: "image", name: card.note.image });
    if (card.note.audio && mimeFor(card.note.audio)?.startsWith("audio/")) uploads.push({ cardId, kind: "audio", name: card.note.audio });
  });
  let mediaFailed = 0;
  let mediaDone = 0;
  if (uploads.length > 0) onProgress({ phase: "media", done: 0, total: uploads.length });
  for (let start = 0; start < uploads.length; start += MEDIA_BATCH) {
    const batch = uploads.slice(start, start + MEDIA_BATCH);
    const files = opened.collection.media(batch.map((u) => u.name));
    for (let j = 0; j < batch.length; j += UPLOADS_AT_ONCE) {
      await Promise.all(batch.slice(j, j + UPLOADS_AT_ONCE).map(async (u) => {
        const bytes = files.get(u.name);
        try {
          if (!bytes) throw new Error("missing from the export");
          const contentType = mimeFor(u.name)!;
          await api.attachCardFile(u.cardId, u.kind, { name: u.name, body: new Blob([bytes as BlobPart], { type: contentType }), contentType });
        } catch {
          mediaFailed++; // a card without its picture still works; report the count
        }
        mediaDone++;
      }));
      onProgress({ phase: "media", done: mediaDone, total: uploads.length });
    }
  }
  return { created, duplicates: total - created, mediaFailed };
}
