import { newCardState, type Source } from '@schwanki/core';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { api, requireAccount, supabase } from './backend';
import { getStore } from './nativeStore';
import { MATERIAL_LIMIT, powerpointText } from './materialText';
import type { WordPair } from './creationData';

export interface Material { name: string; bytes: Uint8Array; contentType: string }
export interface MaterialDraft { source: Source; uri: string; contentType: string; uploaded?: boolean }
export async function chooseMaterial(photos = false): Promise<Material | null> {
  let uri: string, name: string;
  if (photos) {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
    if (result.canceled) return null;
    uri = result.assets[0]!.uri; name = result.assets[0]!.fileName ?? 'Class photo.jpg';
  } else {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return null;
    uri = result.assets[0]!.uri; name = result.assets[0]!.name;
  }
  const file = new File(uri);
  if (photos || /\.(jpe?g|png|webp|heic|heif)$/i.test(name)) {
    if (file.size > 30 * 1024 * 1024) throw new Error('Choose a photo under 30 MB.');
    // Width and height must both fit the vision endpoint's 2400px longest edge.
    const first = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: .85 });
    const longest = Math.max(first.width, first.height);
    const output = longest > 2400 ? await manipulateAsync(first.uri, [{ resize: first.width >= first.height ? { width: 2400 } : { height: 2400 } }], { format: SaveFormat.JPEG, compress: .85 }) : first;
    const bytes = await new File(output.uri).bytes();
    if (bytes.byteLength > MATERIAL_LIMIT) throw new Error('This photo is still over 10 MB. Choose a smaller image.');
    return { name: name.replace(/\.[^.]+$/, '') + '.jpg', bytes, contentType: 'image/jpeg' };
  }
  if (/\.pptx$/i.test(name)) {
    if (file.size > 100 * 1024 * 1024) throw new Error('Choose a PowerPoint under 100 MB.');
    return textMaterial(name, powerpointText(await file.bytes()));
  }
  if (!/\.pdf$/i.test(name)) throw new Error('Choose a PDF, .pptx, photo or screenshot. Save older .ppt files as PDF or .pptx first.');
  if (file.size > MATERIAL_LIMIT) throw new Error('Choose a PDF under 10 MB. You can also use its .pptx file.');
  return { name, bytes: await file.bytes(), contentType: 'application/pdf' };
}
export function textMaterial(name: string, text: string): Material {
  const bytes = new TextEncoder().encode(text.trim());
  if (!bytes.length) throw new Error('Paste some words or notes first.');
  if (bytes.byteLength > MATERIAL_LIMIT) throw new Error('Split these notes into smaller sections (under 10 MB).');
  return { name, bytes, contentType: 'text/plain' };
}
async function fingerprint(bytes: Uint8Array) {
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function saveWords(userId: string, language: string, label: string, ref: string, words: WordPair[]) {
  if (!words.length || words.some(w => !w.front.trim() || !w.back.trim())) throw new Error('Every card needs a word and meaning.');
  await requireAccount(userId);
  const sources = await api.listSources();
  const source = sources.find(s => s.type === 'manual' && s.externalRef === ref && s.language === language)
    ?? await api.addSource({ type: 'manual', externalRef: ref, label, language });
  await requireAccount(userId);
  const ids = await api.importCards(source.id, language, words.map(w => ({ ...w, state: newCardState(new Date()) })));
  const created = ids.filter(Boolean).length;
  return { sourceId: created ? source.id : null, created, duplicates: words.length - created };
}
export async function savePastedWords(userId: string, language: string, label: string, words: WordPair[]) {
  const hash = await fingerprint(new TextEncoder().encode(JSON.stringify(words)));
  return saveWords(userId, language, label, `mobile:words:${hash}`, words);
}
export async function pendingMaterial(userId: string) {
  return (await getStore()).get<MaterialDraft>(userId, 'materialDraft');
}
export async function stageMaterial(userId: string, language: string, label: string, material: Material, externalRef?: string): Promise<MaterialDraft> {
  await requireAccount(userId);
  if (await pendingMaterial(userId)) throw new Error('Finish the saved upload first. Open Check new words to resume it.');
  if (!material.bytes.length || material.bytes.byteLength > MATERIAL_LIMIT) throw new Error('Choose a non-empty file under 10 MB.');
  const folder = new Directory(Paths.document, 'materials', userId);
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `${Crypto.randomUUID()}.upload`);
  file.create(); file.write(material.bytes);
  try {
    const source = await api.addSource({ type: 'pdf_upload', externalRef: externalRef || material.name, label, language });
    const draft = { source, uri: file.uri, contentType: material.contentType };
    await (await getStore()).set(userId, 'materialDraft', draft);
    return draft;
  } catch (error) { if (file.exists) file.delete(); throw error; }
}
export async function syncMaterial(userId: string, source: Source): Promise<string> {
  await requireAccount(userId);
  const { data, error } = await supabase.functions.invoke(source.type === 'pdf_upload' ? 'sync-pdf' : 'sync-google', { body: { sourceId: source.id } });
  if (error) throw error;
  const result = data?.results?.[source.id];
  if (typeof result !== 'string') throw new Error('The reader did not respond. Check new words or retry shortly.');
  if (result.startsWith('failed:')) throw new Error(result.slice(7));
  return result;
}
export async function resumeMaterial(userId: string, draft: MaterialDraft) {
  await requireAccount(userId);
  const file = new File(draft.uri);
  if (!file.exists) throw new Error('The saved file is missing. Remove this saved upload and choose the original file again.');
  const { error } = await supabase.storage.from('source-files').upload(`${userId}/${draft.source.id}.pdf`, await file.arrayBuffer(), { upsert: true, contentType: draft.contentType });
  if (error) throw error;
  await (await getStore()).set(userId, 'materialDraft', { ...draft, uploaded: true });
  const result = await syncMaterial(userId, draft.source);
  await (await getStore()).set(userId, 'materialDraft', null);
  if (file.exists) file.delete();
  return result;
}
export async function discardMaterial(userId: string, draft: MaterialDraft) {
  await requireAccount(userId);
  const saved = await pendingMaterial(userId);
  if (!(saved?.source.id === draft.source.id ? saved.uploaded : draft.uploaded)) {
    // A timed-out PUT may have succeeded. Check Storage before removing an empty
    // source; otherwise its scheduled reader would retry a missing file forever.
    const name = `${draft.source.id}.pdf`;
    const { data, error } = await supabase.storage.from('source-files').list(userId, { search: name, limit: 100 });
    if (error) throw error; // Keep the only local copy until we can verify this.
    if (!data?.some(file => file.name === name)) {
      await requireAccount(userId);
      await api.removeSource(draft.source.id, 'keep');
    }
  }
  // Uploaded sources keep their remote file, candidates and study cards.
  await (await getStore()).set(userId, 'materialDraft', null);
  const file = new File(draft.uri); if (file.exists) file.delete();
}
