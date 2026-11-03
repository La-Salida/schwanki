import { beforeEach, expect, it, vi } from 'vitest';
import type { Source } from '@schwanki/core';
const mock = vi.hoisted(() => ({
  api: { listSources: vi.fn(), addSource: vi.fn(), importCards: vi.fn() }, requireAccount: vi.fn(),
  upload: vi.fn(), invoke: vi.fn(), get: vi.fn(), set: vi.fn(), files: new Map<string, Uint8Array>(),
  documents: vi.fn(), photos: vi.fn(),
}));
vi.mock('./backend', () => ({ api: mock.api, requireAccount: mock.requireAccount, supabase: { storage: { from: () => ({ upload: mock.upload }) }, functions: { invoke: mock.invoke } } }));
vi.mock('./nativeStore', () => ({ getStore: async () => ({ get: mock.get, set: mock.set }) }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mock.documents }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: mock.photos }));
vi.mock('expo-image-manipulator', () => ({ manipulateAsync: vi.fn(), SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid', digest: async () => new Uint8Array([1, 2]).buffer, CryptoDigestAlgorithm: { SHA256: 'sha256' } }));
vi.mock('expo-file-system', () => ({ Paths: { document: 'documents' },
  Directory: class { uri: string; constructor(...parts: string[]) { this.uri = parts.join('/'); } create() {} },
  File: class {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/'); }
    get exists() { return mock.files.has(this.uri); }
    get size() { return mock.files.get(this.uri)?.byteLength ?? 0; }
    create() { mock.files.set(this.uri, new Uint8Array()); }
    write(bytes: Uint8Array) { mock.files.set(this.uri, bytes); }
    async arrayBuffer() { return Uint8Array.from(mock.files.get(this.uri)!).buffer; }
    async bytes() { return mock.files.get(this.uri)!; }
    delete() { mock.files.delete(this.uri); }
  },
}));
import { chooseMaterial, resumeMaterial, saveWords, stageMaterial, textMaterial } from './creation';
const source = { id: 'source', userId: 'owner', language: 'es', type: 'pdf_upload', externalRef: 'notes', label: 'Notes', status: 'active' } as Source;
beforeEach(() => {
  vi.resetAllMocks(); mock.files.clear(); mock.requireAccount.mockResolvedValue(undefined);
  mock.get.mockResolvedValue(null); mock.set.mockResolvedValue(undefined); mock.api.addSource.mockResolvedValue(source);
  mock.api.listSources.mockResolvedValue([]); mock.upload.mockResolvedValue({ error: null });
});
it('checkpoints the owned file before upload and resumes with ArrayBuffer + correct MIME', async () => {
  const draft = await stageMaterial('owner', 'es', 'Notes', textMaterial('Notes.txt', 'hola'));
  expect(mock.set).toHaveBeenCalledWith('owner', 'materialDraft', draft);
  expect(mock.upload).not.toHaveBeenCalled();
  mock.invoke.mockResolvedValueOnce({ error: new Error('network stopped') });
  await expect(resumeMaterial('owner', draft)).rejects.toThrow('network stopped');
  expect(mock.files.has(draft.uri)).toBe(true);
  expect(mock.set).not.toHaveBeenCalledWith('owner', 'materialDraft', null);
  mock.invoke.mockResolvedValueOnce({ data: { results: { source: 'diffed:1' } }, error: null });
  await expect(resumeMaterial('owner', draft)).resolves.toBe('diffed:1');
  expect(mock.upload).toHaveBeenLastCalledWith('owner/source.pdf', expect.any(ArrayBuffer), { upsert: true, contentType: 'text/plain' });
  expect(mock.invoke).toHaveBeenCalledWith('sync-pdf', { body: { sourceId: 'source' } });
  expect(mock.set).toHaveBeenCalledWith('owner', 'materialDraft', null);
  expect(mock.files.has(draft.uri)).toBe(false);
});
it('keeps a saved upload safe when the backend reports a terminal failure', async () => {
  const draft = await stageMaterial('owner', 'es', 'Notes', textMaterial('Notes.txt', 'hola'));
  mock.invoke.mockResolvedValue({ data: { results: { source: 'failed:No credits remaining' } } });
  await expect(resumeMaterial('owner', draft)).rejects.toThrow('No credits remaining');
  expect(mock.files.has(draft.uri)).toBe(true);
});
it('refuses a second pending upload or a changed account before creating a source', async () => {
  mock.get.mockResolvedValue({ uri: 'original' });
  await expect(stageMaterial('owner', 'es', 'New', textMaterial('new', 'hola'))).rejects.toThrow('saved upload');
  expect(mock.api.addSource).not.toHaveBeenCalled();
  mock.requireAccount.mockRejectedValue(new Error('different account'));
  await expect(saveWords('owner', 'es', 'Words', 'ref', [{ front: 'hola', back: 'hello' }])).rejects.toThrow('different account');
  expect(mock.api.importCards).not.toHaveBeenCalled();
});
it('reuses starter sources, keeps duplicate cards untouched, and supplies a fresh schedule', async () => {
  mock.api.listSources.mockResolvedValue([{ ...source, type: 'manual', externalRef: 'starter' }]);
  mock.api.importCards.mockResolvedValue([null]);
  expect(await saveWords('owner', 'es', 'First words', 'starter', [{ front: 'hola', back: 'hello' }])).toEqual({ sourceId: null, created: 0, duplicates: 1 });
  expect(mock.api.addSource).not.toHaveBeenCalled();
  expect(mock.api.importCards).toHaveBeenCalledWith('source', 'es', [expect.objectContaining({ state: expect.objectContaining({ dueAt: expect.any(Date), reps: 0, lapses: 0, fsrs: expect.any(Object) }) })]);
});
it('makes canceled pickers a no-op and rejects an oversized PDF before reading it', async () => {
  mock.documents.mockResolvedValueOnce({ canceled: true });
  mock.photos.mockResolvedValueOnce({ canceled: true });
  expect(await chooseMaterial()).toBeNull(); expect(await chooseMaterial(true)).toBeNull();
  mock.documents.mockResolvedValue({ canceled: false, assets: [{ uri: 'big', name: 'big.pdf' }] });
  mock.files.set('big', new Uint8Array(10 * 1024 * 1024 + 1));
  await expect(chooseMaterial()).rejects.toThrow('under 10 MB');
  expect(mock.api.addSource).not.toHaveBeenCalled();
});
