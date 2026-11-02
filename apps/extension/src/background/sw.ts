import { needsRefresh, refreshSession, sessionFromTokenHash, trustedHandoff, validateHandoff, type ExtensionSession } from './auth';
import { database, deleteLocal, recoverInterrupted, updateManifest } from '../recording/store';
import { recordingStatuses } from '../recording/upload';

const WEB=import.meta.env.VITE_WEB_ORIGIN as string;
const API=import.meta.env.VITE_API_ORIGIN as string;
const KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const AUTH_PATH='/extension-auth';
const OFFSCREEN='offscreen.html';
const MIN_UPLOAD_MS=5000;
let creating:Promise<void>|null=null;
let acquiring=false;
const autoUploaded=new Set<string>();

async function ensureOffscreen() {
  if(await chrome.offscreen.hasDocument()) return;
  if(!creating) creating=chrome.offscreen.createDocument({url:OFFSCREEN,reasons:[chrome.offscreen.Reason.USER_MEDIA],justification:'Record the lesson tab and microphone, and upload the recording, independently of the panel and service worker'}).finally(()=>creating=null);
  await creating;
}

async function storedSession():Promise<ExtensionSession|null> {
  const {authSession}=await chrome.storage.local.get('authSession');
  return (authSession as ExtensionSession|undefined)??null;
}

/** An access token with at least `minSeconds` left, refreshing the extension's own session when needed. */
async function accessToken(minSeconds=600):Promise<string|null> {
  const session=await storedSession();
  if(!session) return null;
  if(!needsRefresh(session,minSeconds)) return session.accessToken;
  try {
    const fresh=await refreshSession(API,KEY,session);
    await chrome.storage.local.set({authSession:fresh});
    return fresh.accessToken;
  } catch(error) {
    // A rejected refresh token means the session is gone; a network error keeps it for a retry.
    if((error as {status?:number}).status&&(error as {status:number}).status<500) await chrome.storage.local.remove('authSession');
    return null;
  }
}

function notifyPanel() { void chrome.runtime.sendMessage({target:'panel',action:'uploads-changed'}).catch(()=>{}); }

async function startUpload(id:string) {
  const db=await database();const manifest=await db.get('manifests',id);
  if(!manifest) throw new Error('Recording not found on this computer.');
  if(manifest.durationMs<MIN_UPLOAD_MS) {
    await updateManifest(id,m=>{m.upload={state:'failed',error:'This recording is too short to send.'};});notifyPanel();return;
  }
  const token=await accessToken();
  if(!token) { await updateManifest(id,m=>{m.upload={state:'signed_out',error:null};});notifyPanel();return; }
  await ensureOffscreen();
  const response=await chrome.runtime.sendMessage({target:'recorder',action:'upload',id,accessToken:token});
  if(response?.error) throw new Error(response.error);
}

/** Asks the server how sent lessons are doing, so the panel can say when cards are ready. */
async function refreshProcessing() {
  const db=await database();
  const sent=(await db.getAll('manifests')).filter(m=>m.upload?.state==='processing'&&m.upload.recordingId);
  if(sent.length===0) return;
  const token=await accessToken(60);
  if(!token) return;
  const rows=await recordingStatuses(sent.map(m=>m.upload!.recordingId!),{api:API,publishableKey:KEY,accessToken:token,fetch:fetch.bind(globalThis)});
  for(const row of rows) {
    const manifest=sent.find(m=>m.upload!.recordingId===row.id)!;
    if(row.status==='ready') await updateManifest(manifest.id,m=>{m.upload={...m.upload!,state:'done'};});
    if(row.status==='failed') await updateManifest(manifest.id,m=>{m.upload={...m.upload!,state:'failed',error:row.error_detail??'Processing failed.'};});
  }
  notifyPanel();
}

chrome.action.onClicked.addListener(tab=>{
  if(tab.id) {void chrome.storage.session.set({classroomTabId:tab.id});void chrome.sidePanel.open({tabId:tab.id});}
});
chrome.runtime.onInstalled.addListener(()=>{
  void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  void chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  void chrome.alarms.create('lesson-status',{periodInMinutes:2});
});
chrome.runtime.onStartup.addListener(()=>{void recoverInterrupted();void chrome.alarms.create('lesson-status',{periodInMinutes:2});});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='lesson-status')void refreshProcessing().catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>{
  void chrome.storage.session.get('classroomTabId').then(({classroomTabId})=>{
    if(tabId===classroomTabId) void chrome.runtime.sendMessage({target:'recorder',action:'stop',warning:'The lesson tab was closed, so recording stopped. Everything up to then was saved.'}).catch(()=>{});
  });
});

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || message.target!=='background'||!sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if(message.action==='recorder-status'){
    if(sender.url!==chrome.runtime.getURL('offscreen.html'))return;
    void chrome.action.setBadgeText({text:message.state==='recording'?'REC':message.state==='paused'?'Ⅱ':''});
    void chrome.action.setBadgeBackgroundColor({color:'#C8372D'});
    // A finished recording is sent as soon as it stops, however it stopped.
    if((message.state==='saved'||message.state==='interrupted')&&typeof message.id==='string'&&!autoUploaded.has(message.id)) {
      autoUploaded.add(message.id);void startUpload(message.id).catch(()=>{});
    }
    respond({ok:true});return;
  }
  void (async()=>{
    if(message.action==='record') {
      if(acquiring)throw new Error('Recording is already starting');
      acquiring=true;
      try{
      if(!await chrome.offscreen.hasDocument())await recoverInterrupted();
      const db=await database();const manifests=await db.getAll('manifests');
      if(manifests.some(m=>m.state==='recording'||m.state==='paused')) throw new Error('A lesson is already recording. Stop it first.');
      const {classroomTabId}=await chrome.storage.session.get('classroomTabId');
      if(typeof classroomTabId!=='number') throw new Error('Click the Schwanki button in the toolbar while on your lesson tab.');
      if(typeof message.language!=='string'||!/^[a-z]{2,3}$/.test(message.language)) throw new Error('Pick the language you are learning.');
      // No network request can precede the gesture-dependent operation.
      const streamId=await new Promise<string>((resolve,reject)=>chrome.tabCapture.getMediaStreamId({targetTabId:classroomTabId},id=>{const error=chrome.runtime.lastError;if(error)reject(new Error(error.message));else resolve(id);}));
      await ensureOffscreen();
      const response=await chrome.runtime.sendMessage({target:'recorder',action:'start',streamId,tabId:classroomTabId,language:message.language});
      if(response?.error) throw new Error(response.error);
      return response;
      }finally{acquiring=false;}
    }
    if(message.action==='status') {if(!acquiring&&!await chrome.offscreen.hasDocument())await recoverInterrupted();const db=await database();return db.getAll('manifests');}
    if(['pause','resume','stop'].includes(message.action)) {
      const response=await chrome.runtime.sendMessage({target:'recorder',action:message.action});
      if(response?.error) throw new Error(response.error);
      return response;
    }
    if(message.action==='auth-status') {const session=await storedSession();return {signedIn:Boolean(session),email:session?.email??null};}
    if(message.action==='sign-in') {await chrome.tabs.create({url:`${WEB}${AUTH_PATH}?extensionId=${chrome.runtime.id}`});return {ok:true};}
    if(message.action==='sign-out') {await chrome.storage.local.remove('authSession');return {ok:true};}
    if(message.action==='upload') {if(typeof message.id!=='string')throw new Error('Unknown recording');await startUpload(message.id);return {ok:true};}
    if(message.action==='refresh') {await refreshProcessing();return {ok:true};}
    if(message.action==='delete') {if(typeof message.id!=='string')throw new Error('Unknown recording');await deleteLocal(message.id);return {ok:true};}
    throw new Error('Unknown action');
  })().then(result=>respond({result})).catch(error=>respond({error:String(error.message??error)}));
  return true;
});

chrome.runtime.onMessageExternal.addListener((message,sender,respond)=>{
  if(sender.id||!trustedHandoff(sender.url,WEB,AUTH_PATH)||message?.action!=='session-handoff'){respond({error:'Untrusted sign-in handoff'});return;}
  void (async()=>{
    const session=await sessionFromTokenHash(API,KEY,validateHandoff(message));
    await chrome.storage.local.set({authSession:session});
    void chrome.runtime.sendMessage({target:'panel',action:'auth-changed'}).catch(()=>{});
    // Lessons recorded while signed out go now.
    const db=await database();
    for(const m of await db.getAll('manifests')) if(m.upload?.state==='signed_out') void startUpload(m.id).catch(()=>{});
  })().then(()=>respond({ok:true})).catch(()=>respond({error:'Sign-in failed. Try connecting again.'}));return true;
});
