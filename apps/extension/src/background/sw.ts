import { trustedHandoff, validateSession } from './auth';
import { database, recoverInterrupted } from '../recording/store';
const OFFSCREEN='offscreen.html';
let creating:Promise<void>|null=null;
let acquiring=false;
async function ensureOffscreen() {
  if(await chrome.offscreen.hasDocument()) return;
  if(!creating) creating=chrome.offscreen.createDocument({url:OFFSCREEN,reasons:[chrome.offscreen.Reason.USER_MEDIA],justification:'Own the selected classroom and microphone audio independently of the panel and service worker'}).finally(()=>creating=null);
  await creating;
}
chrome.action.onClicked.addListener(tab=>{
  if(tab.id) {void chrome.storage.session.set({classroomTabId:tab.id});void chrome.sidePanel.open({tabId:tab.id});}
});
chrome.runtime.onInstalled.addListener(()=>{
  void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  void chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
});
chrome.runtime.onStartup.addListener(()=>void recoverInterrupted());
chrome.tabs.onRemoved.addListener(tabId=>{
  void chrome.storage.session.get('classroomTabId').then(({classroomTabId})=>{
    if(tabId===classroomTabId) void chrome.runtime.sendMessage({target:'recorder',action:'stop',warning:'Classroom tab closed. Completed fragments were saved.'});
  });
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || message.target!=='background'||!sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  if(message.action==='recorder-status'){
    if(sender.url!==chrome.runtime.getURL('offscreen.html'))return;
    void chrome.action.setBadgeText({text:message.state==='recording'?'REC':message.state==='paused'?'Ⅱ':''});
    void chrome.action.setBadgeBackgroundColor({color:'#b33136'});respond({ok:true});return;
  }
  void (async()=>{
    if(message.action==='record') {
      if(acquiring)throw new Error('Capture is already starting');
      acquiring=true;
      try{
      if(!await chrome.offscreen.hasDocument())await recoverInterrupted();
      const db=await database();const manifests=await db.getAll('manifests');
      if(manifests.some(m=>m.state==='recording'||m.state==='paused')) throw new Error('A class is already active; stop or recover it first');
      const {classroomTabId}=await chrome.storage.session.get('classroomTabId');
      if(typeof classroomTabId!=='number') throw new Error('Click the extension toolbar button on the classroom tab first');
      // No network request can precede the gesture-dependent operation.
      const streamId=await new Promise<string>((resolve,reject)=>chrome.tabCapture.getMediaStreamId({targetTabId:classroomTabId},id=>{const error=chrome.runtime.lastError;if(error)reject(new Error(error.message));else resolve(id);}));
      await ensureOffscreen();
      const response=await chrome.runtime.sendMessage({target:'recorder',action:'start',streamId,tabId:classroomTabId});
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
    throw new Error('Unknown recording action');
  })().then(result=>respond({result})).catch(error=>respond({error:String(error.message??error)}));
  return true;
});

chrome.runtime.onMessageExternal.addListener((message,sender,respond)=>{
  const origin=import.meta.env.VITE_WEB_ORIGIN??'http://localhost:5173';
  const path=import.meta.env.VITE_AUTH_PATH??'/extension-auth';
  if(sender.id||!trustedHandoff(sender.url,origin,path)||message?.action!=='session-handoff'){respond({error:'Untrusted session handoff'});return;}
  void (async()=>{
    const session=validateSession(message.session);
    await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
    await chrome.storage.session.set({authSession:session});
  })().then(()=>respond({ok:true})).catch(()=>respond({error:'Invalid or expired session handoff'}));return true;
});
