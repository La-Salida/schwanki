import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ClassRecorder} from './recorder';
import {database,fragmentsFor} from './store';
import {orderedParts} from './manifest';
const encoders:Encoder[]=[];
class Encoder extends EventTarget {
 static isTypeSupported=()=>true;
 state='inactive';mimeType='audio/webm;codecs=opus';
 constructor(readonly stream:MediaStream){super();encoders.push(this);}
 start(){this.state='recording';}
 emit(text='audio'){const event=new Event('dataavailable');Object.assign(event,{data:new Blob([text])});this.dispatchEvent(event);}
 stop(){this.emit('tail');this.state='inactive';queueMicrotask(()=>this.dispatchEvent(new Event('stop')));}
}
const contexts:Context[]=[];
class Context {
 connections:Array<{stream:MediaStream;target:unknown}>=[];destination={};state='running';close=vi.fn(async()=>{this.state='closed';});resume=vi.fn(async()=>{});
 constructor(){contexts.push(this);}
 createMediaStreamSource(stream:MediaStream){return{connect:vi.fn(target=>this.connections.push({stream,target}))};}
 createAnalyser(){return{fftSize:512,getFloatTimeDomainData:(values:Float32Array)=>values.fill(.04)};}
}
function stream(){const track=new EventTarget() as EventTarget&{stop:ReturnType<typeof vi.fn>};track.stop=vi.fn();return {getTracks:()=>[track],track} as unknown as MediaStream&{track:typeof track};}
let time=0;
beforeEach(async()=>{vi.useFakeTimers({toFake:["setInterval","clearInterval"]});vi.spyOn(performance,'now').mockImplementation(()=>time);time=0;encoders.length=0;contexts.length=0;vi.stubGlobal('MediaRecorder',Encoder);vi.stubGlobal('AudioContext',Context);const db=await database();await db.clear('fragments');await db.clear('manifests');});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
describe('offscreen recorder control and durability',()=>{
 it('writes channel-separated fragments before terminal status and releases both tracks',async()=>{
  const mic=stream(),tab=stream();const publish=vi.fn();const recorder=new ClassRecorder(publish);
  await recorder.start('stream',1,'10000000-0000-0000-0000-000000000001',mic,tab);time=5000;encoders.forEach(e=>e.emit());time=6000;await recorder.stop();
  expect(await fragmentsFor('10000000-0000-0000-0000-000000000001')).toHaveLength(4);expect(orderedParts(await fragmentsFor('10000000-0000-0000-0000-000000000001'))).toHaveLength(2);
  expect(mic.track.stop).toHaveBeenCalledOnce();expect(tab.track.stop).toHaveBeenCalledOnce();expect(contexts[0]?.close).toHaveBeenCalledOnce();expect(contexts[0]?.resume).toHaveBeenCalledOnce();expect(contexts[0]?.connections.filter(c=>c.target===contexts[0]?.destination).map(c=>c.stream)).toEqual([tab]);expect(publish.mock.calls.at(-1)?.[0].manifest.state).toBe('saved');
 });
 it('creates independent media parts and an explicit gap around pause/resume',async()=>{
  const recorder=new ClassRecorder(()=>{});await recorder.start('',1,'10000000-0000-0000-0000-000000000002',stream(),stream());time=5000;await recorder.pause();time=15000;await recorder.resume();time=20000;await recorder.stop();
  const m=await(await database()).get('manifests','10000000-0000-0000-0000-000000000002');expect(m?.gaps).toEqual([{startMs:5000,endMs:15000}]);expect(orderedParts(await fragmentsFor('10000000-0000-0000-0000-000000000002'))).toHaveLength(4);
 });
 it('stops on input loss and preserves emitted audio',async()=>{
  const mic=stream();const publish=vi.fn();const recorder=new ClassRecorder(publish);await recorder.start('',1,'10000000-0000-0000-0000-000000000003',mic,stream());time=5000;mic.track.dispatchEvent(new Event('ended'));await recorder.stop();expect((await(await database()).get('manifests','10000000-0000-0000-0000-000000000003'))?.state).toBe('interrupted');expect(await fragmentsFor('10000000-0000-0000-0000-000000000003')).toHaveLength(2);
 });
 it('rejects concurrent starts during microphone acquisition',async()=>{
  let resolveMic:(value:MediaStream)=>void=()=>{};const mic=stream();const tab=stream();
  const getUserMedia=vi.fn().mockImplementationOnce(()=>new Promise<MediaStream>(resolve=>resolveMic=resolve)).mockResolvedValueOnce(tab);vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  const recorder=new ClassRecorder(()=>{});const first=recorder.start('capture',1);await expect(recorder.start('second',2)).rejects.toThrow('already recording');resolveMic(mic);await first;time=5000;await recorder.stop();
 });
 it('does not allow a paused write to overwrite simultaneous Stop',async()=>{
  const recorder=new ClassRecorder(()=>{});await recorder.start('',1,'10000000-0000-0000-0000-000000000004',stream(),stream());time=5000;await Promise.all([recorder.pause(),recorder.stop()]);expect((await(await database()).get('manifests','10000000-0000-0000-0000-000000000004'))?.state).toBe('saved');
 });
 it('does not acquire or silence the classroom tab when microphone permission fails',async()=>{
  const getUserMedia=vi.fn().mockRejectedValue(new Error('Permission denied'));vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  const recorder=new ClassRecorder(()=>{});await expect(recorder.start('capture',1)).rejects.toThrow('Permission denied');expect(getUserMedia).toHaveBeenCalledTimes(1);expect(contexts).toHaveLength(0);
 });
});
