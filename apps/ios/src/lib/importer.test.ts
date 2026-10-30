import { beforeEach, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  listSources: vi.fn(), addSource: vi.fn(), importAnkiBatch: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(null),
}));
vi.mock('expo-document-picker', () => ({}));
vi.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: {} }));
vi.mock('expo-sqlite', () => ({}));
vi.mock('expo-crypto', () => ({}));
vi.mock('./nativeStore', () => ({ getStore: async () => harness }));
vi.mock('./backend', () => ({ requireAccount: async () => undefined, api: harness }));
import { runImport, type OpenedImport } from './importer';
function opened(): OpenedImport {
  return {
    job: { uri: 'file://deck.apkg', name: 'deck.apkg', fingerprint: 'hash', language: 'es', selected: ['Deck'], sources: {}, mapped: {}, uploaded: [] },
    plan: { decks: [{ name: 'Deck', cards: [{ card: { noteId: 1, note: { front: 'word', back: 'meaning' }, reviews: [] }, state: null }] }] },
    collection: {},
  } as unknown as OpenedImport;
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.listSources.mockResolvedValue([{ id: 'spanish', type: 'anki_deck', externalRef: 'anki:sha256:hash#Deck', language: 'es' }]);
  harness.addSource.mockResolvedValue({ id: 'french' });
  harness.importAnkiBatch.mockResolvedValue([{ id: 'saved', ownsMedia: true, created: true }]);
});
it('resolves a new source when the language changes after the first card batch failed', async () => {
  const input = opened();
  harness.importAnkiBatch.mockRejectedValueOnce(new Error('Offline'));
  await expect(runImport('user-a', input, () => {})).rejects.toThrow('Offline');
  expect(input.job.sources.Deck).toBe('spanish');
  input.job.language = 'fr';
  await runImport('user-a', input, () => {});
  expect(harness.addSource).toHaveBeenCalledWith(expect.objectContaining({ language: 'fr' }));
  expect(harness.importAnkiBatch.mock.calls[1]?.[0]).toBe('french');
});
it('reuses a checkpointed source when its language still matches', async () => {
  const input = opened(); input.job.sources.Deck = 'spanish';
  await runImport('user-a', input, () => {});
  expect(harness.addSource).not.toHaveBeenCalled();
  expect(harness.importAnkiBatch).toHaveBeenCalledWith('spanish', expect.any(Array));
});
