import { expect, it, vi } from 'vitest';
const files = vi.hoisted(() => ({ paths: new Set<string>(), removed: [] as string[] }));
vi.mock('expo-file-system', () => ({
  File: class {}, Paths: { cache: 'cache', document: 'documents' },
  Directory: class {
    uri: string;
    constructor(...parts: string[]) { this.uri = parts.join('/'); }
    get exists() { return files.paths.has(this.uri); }
    delete() { files.paths.delete(this.uri); files.removed.push(this.uri); }
  },
}));
vi.mock('./backend', () => ({ api: {}, requireAccount: vi.fn() }));
vi.mock('./nativeStore', () => ({ getStore: vi.fn() }));
import { clearMedia } from './media';
it('removes a signed-out account’s staged class materials while retaining the other account’s files', async () => {
  for (const owner of ['signed-out', 'other']) for (const folder of ['cache/schwanki-media', 'documents/imports', 'documents/materials']) files.paths.add(`${folder}/${owner}`);
  await clearMedia('signed-out');
  expect(files.paths.has('documents/materials/signed-out')).toBe(false);
  expect(files.paths.has('documents/materials/other')).toBe(true);
  expect(files.removed.every(path => path.endsWith('/signed-out'))).toBe(true);
  expect([...files.paths].filter(path => path.endsWith('/other'))).toHaveLength(3);
});
