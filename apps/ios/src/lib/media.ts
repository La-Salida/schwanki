import { File, Directory, Paths } from 'expo-file-system';
import { api, requireAccount } from './backend';
import { getStore } from './nativeStore';
import type { CachedMedia } from './storage';
const LIMIT = 100 * 1024 * 1024;
const inFlight = new Map<string, Promise<CachedMedia>>();
export async function clearMedia(userId: string) {
  const folder = new Directory(Paths.cache, 'schwanki-media', userId);
  if (folder.exists) folder.delete();
  const imports = new Directory(Paths.document, 'imports', userId);
  if (imports.exists) imports.delete();
}
export function loadMedia(userId: string, cardId: string, online: boolean, protect: string[]): Promise<CachedMedia> {
  const key = `${userId}:${cardId}`;
  let active = inFlight.get(key);
  if (!active) { active = load(userId, cardId, online, protect).finally(() => { inFlight.delete(key); }); inFlight.set(key, active); }
  return active;
}
async function load(userId: string, cardId: string, online: boolean, protect: string[]) {
  const store = await getStore();
  const cached = await store.media(userId, cardId);
  for (const kind of ['image', 'audio'] as const) if (cached[kind] && (!cached[kind]!.startsWith('file:') || !new File(cached[kind]!).exists)) delete cached[kind];
  if (!online) return cached;
  try {
    await requireAccount(userId);
    const rows = await api.listCardMedia([cardId]);
    const folder = new Directory(Paths.cache, 'schwanki-media', userId); folder.create({ idempotent: true, intermediates: true });
    const out: CachedMedia = {};
    for (const row of rows) {
      if (row.kind === 'sentence' && row.content) {
        try {
          const sentence = JSON.parse(row.content);
          if (typeof sentence.text === 'string') out.sentence = sentence.text;
          if (typeof sentence.translation === 'string') out.translation = sentence.translation;
        } catch { /* Other media and plain cards remain usable. */ }
      } else if ((row.kind === 'image' || row.kind === 'audio') && row.storagePath) {
        const extension = /\.([a-z0-9]{1,5})$/i.exec(row.storagePath)?.[1] ?? 'bin';
        const file = new File(folder, `${cardId}-${row.kind}-${row.generationId}.${extension}`);
        if (!file.exists) {
          const signed = await api.signedMediaUrl(row.storagePath);
          try { await File.downloadFileAsync(signed, file, { idempotent: true }); }
          catch { out[row.kind] = signed; continue; }
        }
        out[row.kind] = file.uri;
      }
    }
    await store.setMedia(userId, cardId, out);
    const files = folder.list().filter((file): file is File => file instanceof File);
    let total = files.reduce((n, file) => n + file.size, 0);
    for (const file of files.sort((a, b) => (a.modificationTime ?? 0) - (b.modificationTime ?? 0))) {
      if (total <= LIMIT) break;
      if (!protect.some(id => file.name.startsWith(id))) { total -= file.size; file.delete(); }
    }
    return out;
  } catch { return cached; }
}
