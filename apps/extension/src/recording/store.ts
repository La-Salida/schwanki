import { chunkKey, type Chunk, type Recording } from './manifest';

const request = <T>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const completed = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed.'));
});
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const open = indexedDB.open('schwanki-class-capture', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('recordings', { keyPath: 'id' });
      const chunks = open.result.createObjectStore('chunks', { keyPath: 'key' });
      chunks.createIndex('recordingId', 'recordingId');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
export async function saveRecording(recording: Recording): Promise<void> {
  const tx = (await db()).transaction('recordings', 'readwrite');
  const done = completed(tx);
  tx.objectStore('recordings').put(recording);
  await done;
}
export async function recordings(): Promise<Recording[]> {
  return request((await db()).transaction('recordings').objectStore('recordings').getAll());
}
export async function getRecording(id: string): Promise<Recording> {
  const result: Recording | undefined = await request((await db()).transaction('recordings').objectStore('recordings').get(id));
  if (!result) throw new Error('Recording not found on this device.');
  return result;
}
export async function updateRecording(id: string, changes: Partial<Omit<Recording, 'id' | 'bytes'>>): Promise<Recording> {
  const tx = (await db()).transaction('recordings', 'readwrite');
  const done = completed(tx);
  void done.catch(() => {});
  const recording: Recording | undefined = await request(tx.objectStore('recordings').get(id));
  if (!recording) { tx.abort(); throw new Error('Recording was deleted.'); }
  Object.assign(recording, changes);
  tx.objectStore('recordings').put(recording);
  await done;
  return recording;
}
export async function saveChunk(chunk: Chunk): Promise<void> {
  const tx = (await db()).transaction(['recordings', 'chunks'], 'readwrite', { durability: 'strict' });
  const done = completed(tx);
  // Register rejection handling immediately; deliberate aborts also reject `done`.
  void done.catch(() => {});
  const store = tx.objectStore('chunks');
  const previous: (Chunk & { key: string }) | undefined = await request(store.get(chunkKey(chunk)));
  if (previous) {
    if (previous.checksum !== chunk.checksum || previous.bytes !== chunk.bytes) {
      tx.abort(); throw new Error('Conflicting fragment checksum.');
    }
    await done; return;
  }
  const recording: Recording | undefined = await request(tx.objectStore('recordings').get(chunk.recordingId));
  if (!recording || !['recording', 'paused'].includes(recording.state)) {
    tx.abort(); throw new Error('Session no longer accepts audio.');
  }
  store.add({ ...chunk, key: chunkKey(chunk) });
  recording.bytes += chunk.bytes;
  tx.objectStore('recordings').put(recording);
  await done;
}
export async function chunksFor(id: string): Promise<Chunk[]> {
  return request((await db()).transaction('chunks').objectStore('chunks').index('recordingId').getAll(id));
}
export async function deleteRecording(id: string): Promise<void> {
  const tx = (await db()).transaction(['recordings', 'chunks'], 'readwrite');
  const done = completed(tx);
  tx.objectStore('recordings').delete(id);
  const keys = await request(tx.objectStore('chunks').index('recordingId').getAllKeys(id));
  keys.forEach(key => tx.objectStore('chunks').delete(key));
  await done;
}
export async function recoverInterrupted(): Promise<void> {
  for (const recording of await recordings()) {
    if (['recording', 'paused'].includes(recording.state)) {
      const chunks = await chunksFor(recording.id);
      for (const part of recording.parts.filter(part => !part.complete)) {
        const saved = chunks.filter(c => c.channel === part.channel && c.part === part.part);
        part.endMs = Math.max(part.startMs, ...saved.map(c => c.startMs + c.durationMs));
      }
      recording.state = 'interrupted';
      recording.reason = 'Browser or recorder restarted. Live streams cannot be recovered; the last uncommitted fragment may be missing.';
      await saveRecording(recording);
    }
  }
}
