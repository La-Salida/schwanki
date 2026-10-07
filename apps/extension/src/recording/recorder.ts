import { DEVELOPMENT_LIMITS, sha256, type Channel, type RecordingManifest } from './manifest';
import { database, saveFragment, saveManifest } from './store';
export interface CaptureStatus { manifest: RecordingManifest; levels: Record<Channel,number>; remoteSavedMs: number }
export class ClassRecorder {
  private streams: MediaStream[]=[];
  private context: AudioContext | null=null;
  private recorders: MediaRecorder[]=[];
  private writes: Promise<void>=Promise.resolve();
  private timer: ReturnType<typeof setInterval> | undefined;
  private origin=0;
  private pauseAt=0;
  private terminal=false;
  private active=false;
  private silentSince:Record<Channel,number>={tab:0,microphone:0};
  private stopping: Promise<void> | null=null;
  private levels: Record<Channel,number>={tab:0,microphone:0};
  private manifest: RecordingManifest | null=null;
  constructor(private publish:(status:CaptureStatus)=>void) {}
  async start(streamId:string,tabId:number,id:string=crypto.randomUUID(),microphone?:MediaStream,tabStream?:MediaStream) {
    if(this.active) throw new Error('A class is already recording');
    this.active=true;
    this.terminal=false; this.writes=Promise.resolve();this.stopping=null;
    try {
      // Acquire microphone first so a denied permission never silences tutor playback.
      const mic=microphone ?? await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      this.streams.push(mic);
      const remote=tabStream ?? await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:streamId}} as MediaTrackConstraints,video:false});
      this.streams.push(remote);
      this.context=new AudioContext();
      this.context.createMediaStreamSource(remote).connect(this.context.destination);
      await this.context.resume();
      this.origin=performance.now();
      this.silentSince={tab:this.origin,microphone:this.origin};
      this.manifest={id,createdAt:new Date().toISOString(),state:'recording',tabId,durationMs:0,bytes:0,nextPart:0,gaps:[],limits:DEVELOPMENT_LIMITS,warning:null};
      await saveManifest(this.manifest);
      for(const stream of this.streams) for(const track of stream.getTracks()) track.addEventListener('ended',()=>void this.stop('Audio input ended. Completed audio is saved.'));
      this.beginPart();
      const meters=this.streams.map(stream=>{const a=this.context!.createAnalyser();a.fftSize=512;this.context!.createMediaStreamSource(stream).connect(a);return a;});
      this.timer=setInterval(()=>{
        const m=this.manifest!;
        meters.forEach((analyser,i)=>{const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);this.levels[i===0?'microphone':'tab']=Math.sqrt(samples.reduce((s,n)=>s+n*n,0)/samples.length);});
        for(const channel of ['tab','microphone'] as const){if(this.levels[channel]>.001)this.silentSince[channel]=performance.now();}
        if(m.state==='recording'){const silent=(['tab','microphone'] as const).filter(channel=>performance.now()-this.silentSince[channel]>15000);m.warning=silent.length?`No recent audio from ${silent.join(' and ')}. Check your input; silence is not proof of speech capture.`:null;}
        this.publish({manifest:m,levels:this.levels,remoteSavedMs:0});
        if(performance.now()-this.origin>=m.limits.maxDurationMs || m.bytes>=m.limits.maxBytes) void this.stop('Recording limit reached. Completed audio is saved.');
      },250);
    } catch(error) { await this.release();this.terminal=true;this.active=false;throw error; }
  }
  private beginPart() {
    const m=this.manifest!; const part=m.nextPart++;const partStart=performance.now()-this.origin;
    this.recorders=this.streams.map((stream,i)=>{
      const channel:Channel=i===0?'microphone':'tab';
      const mimeType=['audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!mimeType) throw new Error('This browser cannot encode Opus WebM audio');
      const recorder=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:32000});
      let sequence=0;let previous=partStart;
      recorder.addEventListener('dataavailable',event=>{
        if(!event.data.size) return;
        const end=performance.now()-this.origin; const startMs=previous; previous=end; const seq=sequence++;
        this.writes=this.writes.then(async()=>{
          const checksum=await sha256(event.data);
          await saveFragment({recordingId:m.id,channel,part,sequence:seq,startMs,durationMs:Math.max(0,end-startMs),bytes:event.data.size,checksum,mimeType:recorder.mimeType,blob:event.data,acknowledged:false});
          const db=await database();const saved=await db.get('manifests',m.id);
          if(saved) {m.bytes=saved.bytes;m.durationMs=saved.durationMs;}
        });
        // Attach a rejection handler immediately; stop only after stop events drain.
        void this.writes.catch(()=>this.stop('Device storage failed. Completed fragments remain recoverable.')).catch(()=>{});
      });
      recorder.addEventListener('error',()=>void this.stop('Audio encoder failed. Completed fragments remain recoverable.'));
      recorder.start(m.limits.fragmentMs);return recorder;
    });
    void saveManifest(m).catch(()=>this.stop('Device storage failed. Completed fragments remain recoverable.')).catch(()=>{});
  }
  private async endPart() {
    await Promise.all(this.recorders.map(recorder=>new Promise<void>(resolve=>{
      if(recorder.state==='inactive'){resolve();return;}
      recorder.addEventListener('stop',()=>resolve(),{once:true});recorder.stop();
    })));
    await this.writes;
  }
  async pause() {
    if(this.manifest?.state!=='recording'||this.terminal) return;
    this.pauseAt=performance.now()-this.origin; await this.endPart();
    if(this.terminal)return;
    this.manifest.state='paused';await saveManifest(this.manifest);
  }
  async resume() {
    if(this.manifest?.state!=='paused'||this.terminal) return;
    this.manifest.gaps.push({startMs:this.pauseAt,endMs:performance.now()-this.origin});
    this.manifest.state='recording';this.beginPart();await saveManifest(this.manifest);
  }
  async stop(warning:string|null=null):Promise<void> {
    if(this.stopping) return this.stopping;
    if(this.terminal || !this.manifest) return;
    this.terminal=true;
    this.stopping=(async()=>{
      let failure=warning;
      try{await this.endPart();}catch{failure='Device storage failed. Only completed fragments were saved.';}
      await this.release();
      this.manifest!.state=failure?'interrupted':'saved';this.manifest!.warning=failure;
      try{await saveManifest(this.manifest!);}catch{this.manifest!.state='interrupted';this.manifest!.warning='Device storage failed. Only completed fragments were saved.';}
      this.active=false;
      this.publish({manifest:this.manifest!,levels:{tab:0,microphone:0},remoteSavedMs:0});
    })();return this.stopping;
  }
  private async release() {
    clearInterval(this.timer);this.timer=undefined;
    for(const stream of this.streams) stream.getTracks().forEach(track=>track.stop());this.streams=[];
    if(this.context&&this.context.state!=='closed')await this.context.close().catch(()=>{});this.context=null;this.recorders=[];
  }
}
