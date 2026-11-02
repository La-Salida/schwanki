import { ClassRecorder } from '../recording/recorder';
import { deleteFragments, fragmentsFor, updateManifest } from '../recording/store';
import { NoCreditsError, uploadRecording } from '../recording/upload';
import type { UploadStatus } from '../recording/manifest';

const API=import.meta.env.VITE_API_ORIGIN as string;
const KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const recorder=new ClassRecorder(status=>{
  void chrome.runtime.sendMessage({target:'panel',action:'status',status}).catch(()=>{});
  void chrome.runtime.sendMessage({target:'background',action:'recorder-status',state:status.manifest.state,id:status.manifest.id}).catch(()=>{});
});
const uploading=new Set<string>();

async function setUpload(id:string,upload:UploadStatus) {
  await updateManifest(id,m=>{m.upload=upload;});
  void chrome.runtime.sendMessage({target:'panel',action:'uploads-changed'}).catch(()=>{});
}

/** Runs here rather than in the service worker, which Chrome can stop during a long upload. */
async function upload(id:string,accessToken:string) {
  if(uploading.has(id)) return;
  uploading.add(id);
  try {
    const manifest=await updateManifest(id,()=>{});
    if(!manifest) throw new Error('Recording not found on this computer.');
    await setUpload(id,{state:'uploading',error:null,...(manifest.upload?.recordingId?{recordingId:manifest.upload.recordingId}:{})});
    const result=await uploadRecording(manifest,await fragmentsFor(id),{api:API,publishableKey:KEY,accessToken,fetch:fetch.bind(globalThis)},(done,total)=>{
      void chrome.runtime.sendMessage({target:'panel',action:'upload-progress',id,done,total}).catch(()=>{});
    });
    await setUpload(id,{state:result.status==='ready'?'done':'processing',recordingId:result.recordingId,error:null,...(result.cost!==undefined?{cost:result.cost}:{}),...(result.free!==undefined?{free:result.free}:{})});
    await deleteFragments(id);
  } catch(error) {
    await setUpload(id,{state:error instanceof NoCreditsError?'no_credits':'failed',error:(error as Error).message});
  } finally { uploading.delete(id); }
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||message.target!=='recorder'||(sender.url&&sender.url!==chrome.runtime.getURL('background.js'))) return;
  void (async()=>{
    if(message.action==='start') return recorder.start(message.streamId,message.tabId,undefined,undefined,undefined,message.language);
    if(message.action==='pause') return recorder.pause();
    if(message.action==='resume') return recorder.resume();
    if(message.action==='stop') return recorder.stop(message.warning??null);
    if(message.action==='upload') { void upload(message.id,message.accessToken); return; }
    throw new Error('Unknown recorder action');
  })().then(()=>respond({ok:true})).catch(error=>respond({error:String(error.message??error)}));return true;
});
