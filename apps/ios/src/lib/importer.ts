import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { deserializeDatabaseAsync } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { openAnkiPackage, readAnkiCollection, planImport, guessLanguage, type AnkiCollection, type ImportPlan, type SqlValue } from '@schwanki/anki';
import { importedReviewHistory } from '@schwanki/core';
import { api, requireAccount } from './backend';
import { getStore } from './nativeStore';

const MAX_FILE_BYTES = 30 * 1024 * 1024;
interface MappedCard { id: string; ownsMedia: boolean }
export interface ImportJob {
  uri: string; name: string; fingerprint: string; language: string; selected: string[];
  sources: Record<string, string>; mapped: Record<string, MappedCard>; uploaded: string[];
}
export interface OpenedImport { collection: AnkiCollection; plan: ImportPlan; job: ImportJob }
export interface ImportProgress { phase: 'cards' | 'media'; deck: string; done: number; total: number }
export interface ImportResult { cards: number; duplicates: number; mediaFailed: number }
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac' };

export async function resumeImport(userId: string): Promise<OpenedImport | null> {
  const job = await (await getStore()).get<ImportJob>(userId, 'pendingImport');
  if (!job) return null;
  if (!new File(job.uri).exists) throw new Error('The saved import file is no longer available. Choose the original export again.');
  return openFile(job);
}
export async function chooseImport(userId: string): Promise<OpenedImport | null> {
  await requireAccount(userId);
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const picked = result.assets[0]!;
  if (!/\.(apkg|colpkg)$/i.test(picked.name)) throw new Error('Choose an .apkg or .colpkg export from Anki.');
  const source = new File(picked.uri);
  if (source.size > MAX_FILE_BYTES) throw new Error('This first iPhone build handles exports up to 30 MB. Import larger decks on the web, then review them here.');
  const folder = new Directory(Paths.document, 'imports', userId); folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, `${Crypto.randomUUID()}.apkg`); source.copy(target);
  try {
    const bytes = await target.bytes();
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes));
    const fingerprint = Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('');
    const opened = await openFile({ uri: target.uri, name: picked.name, fingerprint, language: '', selected: [], sources: {}, mapped: {}, uploaded: [] });
    const store = await getStore();
    const prior = await store.get<ImportJob>(userId, 'pendingImport');
    if (prior?.uri && prior.uri !== target.uri && new File(prior.uri).exists) new File(prior.uri).delete();
    await store.set(userId, 'pendingImport', opened.job);
    return opened;
  } catch (error) { if (target.exists) target.delete(); throw error; }
}
async function openFile(job: ImportJob): Promise<OpenedImport> {
  const opened = openAnkiPackage(await new File(job.uri).bytes(), { collectionBytes: 64 * 1024 * 1024, mediaBytes: 16 * 1024 * 1024 });
  if (opened.database.byteLength > 64 * 1024 * 1024) throw new Error('This collection is too large for this iPhone build. Import it on the web instead.');
  const database = await deserializeDatabaseAsync(opened.database);
  // Object insertion order follows the SQLite column order for these named columns.
  const collection = readAnkiCollection({
    exec(sql) { const rows = database.getAllSync<Record<string, SqlValue>>(sql); return rows.length ? [{ values: rows.map(row => Object.values(row)) }] : []; },
    close() { database.closeSync(); },
  }, opened.media);
  const plan = planImport(collection, new Date());
  if (!plan.decks.length) throw new Error('No usable cards were found. Each note needs a word and a meaning.');
  job.language ||= guessLanguage(collection.cards.map(c => c.note.front)) ?? '';
  if (!job.selected.length) job.selected = plan.decks.map(d => d.name);
  return { collection, plan, job };
}
export async function cancelImport(userId: string) {
  const store = await getStore();
  const pending = await store.get<ImportJob>(userId, 'pendingImport');
  if (pending && new File(pending.uri).exists) new File(pending.uri).delete();
  await store.set(userId, 'pendingImport', null);
}
export async function runImport(userId: string, opened: OpenedImport, progress: (p: ImportProgress) => void): Promise<ImportResult> {
  const { job, plan, collection } = opened;
  if (!job.language.trim()) throw new Error('Choose the language you are learning.');
  const store = await getStore();
  const checkpoint = () => store.set(userId, 'pendingImport', job);
  await checkpoint();
  const result: ImportResult = { cards: 0, duplicates: 0, mediaFailed: 0 };
  for (const deck of plan.decks.filter(d => job.selected.includes(d.name))) {
    await requireAccount(userId);
    const externalRef = `anki:sha256:${job.fingerprint}#${deck.name}`;
    const sources = await api.listSources();
    // A checkpoint can predate a language change if the first card batch failed.
    let sourceId = sources.find(s => s.id === job.sources[deck.name] && s.language === job.language && s.type === 'anki_deck' && s.externalRef === externalRef)?.id;
    if (!sourceId) {
      sourceId = sources.find(s => s.type === 'anki_deck' && s.externalRef === externalRef && s.language === job.language)?.id;
      sourceId ??= (await api.addSource({ type: 'anki_deck', externalRef, label: deck.name, language: job.language })).id;
      job.sources[deck.name] = sourceId; await checkpoint();
    }
    const key = (noteId: number) => `${deck.name}:${noteId}`;
    for (let offset = 0; offset < deck.cards.length; offset += 25) {
      await requireAccount(userId);
      const batch = deck.cards.slice(offset, offset + 25);
      const missing = batch.filter(c => !job.mapped[key(c.card.noteId)]);
      if (missing.length) {
        const saved = await api.importAnkiBatch(sourceId, missing.map(c => ({ ...c.card.note, state: c.state, reviews: importedReviewHistory(c.card.reviews) })));
        saved.forEach((row, i) => { job.mapped[key(missing[i]!.card.noteId)] = row; });
        await checkpoint();
      }
      progress({ phase: 'cards', deck: deck.name, done: Math.min(offset + 25, deck.cards.length), total: deck.cards.length });
      // Yield to native rendering between batches rather than freezing progress.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const uploads = deck.cards.flatMap(c => {
      const mapped = job.mapped[key(c.card.noteId)]!;
      if (!mapped.ownsMedia) { result.duplicates++; return []; }
      result.cards++;
      return (['image', 'audio'] as const).flatMap(kind => {
        const name = c.card.note[kind];
        return name ? [{ kind, name, id: mapped.id, key: `${key(c.card.noteId)}:${kind}` }] : [];
      });
    });
    for (let i = 0; i < uploads.length; i++) {
      const item = uploads[i]!;
      if (!job.uploaded.includes(item.key)) {
        const contentType = MIME[item.name.split('.').pop()?.toLowerCase() ?? ''];
        try {
          await requireAccount(userId);
          const bytes = collection.media([item.name]).get(item.name);
          if (!bytes || !contentType || bytes.byteLength > 16 * 1024 * 1024) throw new Error('Missing or unsupported media');
          await api.attachCardFile(item.id, item.kind, { name: item.name, body: Uint8Array.from(bytes).buffer, contentType });
          job.uploaded.push(item.key); await checkpoint();
        } catch { result.mediaFailed++; }
      }
      progress({ phase: 'media', deck: deck.name, done: i + 1, total: uploads.length });
    }
  }
  if (result.mediaFailed === 0) await cancelImport(userId);
  return result;
}
