import { ClassRecorder } from '../recording/recorder';
const recorder=new ClassRecorder(status=>{
  void chrome.runtime.sendMessage({target:'panel',action:'status',status}).catch(()=>{});
  void chrome.runtime.sendMessage({target:'background',action:'recorder-status',state:status.manifest.state}).catch(()=>{});
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||message.target!=='recorder'||(sender.url&&sender.url!==chrome.runtime.getURL('background.js'))) return;
  void (async()=>{
    if(message.action==='start') return recorder.start(message.streamId,message.tabId);
    if(message.action==='pause') return recorder.pause();
    if(message.action==='resume') return recorder.resume();
    if(message.action==='stop') return recorder.stop(message.warning??null);
    throw new Error('Unknown recorder action');
  })().then(()=>respond({ok:true})).catch(error=>respond({error:String(error.message??error)}));return true;
});
