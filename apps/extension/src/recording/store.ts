import { openDB, type DBSchema } from 'idb';
import { fragmentKey, type Fragment, type RecordingManifest } from './manifest';
interface AudioDB extends DBSchema {
  manifests: { key: string; value: RecordingManifest };
  fragments: { key: string; value: Fragment; indexes: { recording: string } };
}
export const database = () => openDB<AudioDB>('schwanki-class-audio',1,{ upgrade(db) {
  db.createObjectStore('manifests',{keyPath:'id'});
  db.createObjectStore('fragments').createIndex('recording','recordingId');
} });
export async function saveManifest(manifest: RecordingManifest) { const db=await database();const tx=db.transaction('manifests','readwrite',{durability:'strict'});await tx.store.put(manifest);await tx.done; }
export async function saveFragment(fragment: Fragment): Promise<void> {
  const db=await database();
  const tx=db.transaction(['manifests','fragments'],'readwrite',{durability:'strict'});
  const manifest=await tx.objectStore('manifests').get(fragment.recordingId);
  if (!manifest) { tx.abort(); await tx.done.catch(()=>{}); throw new Error('Recording manifest missing'); }
  const previous=await tx.objectStore('fragments').get(fragmentKey(fragment));
  if(previous) {
    if(previous.checksum!==fragment.checksum) { tx.abort(); await tx.done.catch(()=>{}); throw new Error('Conflicting fragment checksum'); }
    await tx.done; return;
  }
  // The last emitted fragment may cross the limit. Keep it, then stop gracefully.
  manifest.bytes+=fragment.bytes;
  manifest.durationMs=Math.max(manifest.durationMs,fragment.startMs+fragment.durationMs);
  await tx.objectStore('fragments').put(fragment,fragmentKey(fragment));
  await tx.objectStore('manifests').put(manifest); await tx.done;
}
export async function fragmentsFor(id:string): Promise<Fragment[]> { const db=await database(); return db.getAllFromIndex('fragments','recording',id); }
export async function acknowledge(fragment:Fragment): Promise<void> {
  const db=await database(); const tx=db.transaction('fragments','readwrite');
  const saved=await tx.store.get(fragmentKey(fragment));
  if(!saved || saved.checksum!==fragment.checksum) { tx.abort(); await tx.done.catch(()=>{}); throw new Error('Acknowledgement checksum mismatch'); }
  saved.acknowledged=true; await tx.store.put(saved,fragmentKey(saved)); await tx.done;
}
export async function recoverInterrupted(): Promise<RecordingManifest[]> {
  const db=await database(); const tx=db.transaction('manifests','readwrite');
  const manifests=await tx.store.getAll();
  for(const m of manifests) if(m.state==='recording'||m.state==='paused') {
    m.state='interrupted';m.warning='Recording was interrupted. Only completed fragments were saved.';await tx.store.put(m);
  }
  await tx.done;return manifests;
}
export async function deleteLocal(id:string): Promise<void> {
  const db=await database();const tx=db.transaction(['fragments','manifests'],'readwrite');
  const keys=await tx.objectStore('fragments').index('recording').getAllKeys(id);
  for(const key of keys) await tx.objectStore('fragments').delete(key);
  await tx.objectStore('manifests').delete(id);await tx.done;
}
