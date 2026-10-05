import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { database, saveFragment, saveManifest, fragmentsFor, recoverInterrupted, acknowledge } from './store';
import { DEVELOPMENT_LIMITS, orderedParts, type Fragment, type RecordingManifest } from './manifest';
const manifest:RecordingManifest={id:'class1',createdAt:'2026-10-05T00:00:00Z',state:'recording',tabId:1,durationMs:0,bytes:0,nextPart:1,gaps:[],limits:DEVELOPMENT_LIMITS,warning:null};
const fragment:Fragment={recordingId:'class1',channel:'tab',part:0,sequence:0,startMs:0,durationMs:5000,bytes:4,checksum:'a'.repeat(64),mimeType:'audio/webm;codecs=opus',blob:new Blob(['test']),acknowledged:false};
beforeEach(async()=>{const db=await database();await db.clear('fragments');await db.clear('manifests');await saveManifest({...manifest});});
describe('durable capture',()=>{
 it('commits manifest bytes and audio together and rejects conflicting replay',async()=>{await saveFragment(fragment);await saveFragment(fragment);expect((await fragmentsFor('class1')).length).toBe(1);expect((await (await database()).get('manifests','class1'))?.bytes).toBe(4);await expect(saveFragment({...fragment,checksum:'b'.repeat(64)})).rejects.toThrow('Conflicting');});
 it('preserves completed fragments after browser restart',async()=>{await saveFragment(fragment);const restored=await recoverInterrupted();expect(restored[0]?.state).toBe('interrupted');expect((await fragmentsFor('class1'))[0]?.acknowledged).toBe(false);});
 it('does not acknowledge a different checksum',async()=>{await saveFragment(fragment);await expect(acknowledge({...fragment,checksum:'bad'})).rejects.toThrow('checksum');expect((await fragmentsFor('class1'))[0]?.acknowledged).toBe(false);});
 it('requires contiguous fragments and never treats timeslices as independent media',()=>{expect(()=>orderedParts([fragment,{...fragment,sequence:2}])).toThrow('Missing');expect(orderedParts([fragment,{...fragment,sequence:1}])[0]?.length).toBe(2);expect(orderedParts([fragment,{...fragment,part:1}])).toHaveLength(2);});
});
