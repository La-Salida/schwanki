import './style.css';
import { deleteLocal, fragmentsFor } from '../recording/store';
import { orderedParts, type RecordingManifest } from '../recording/manifest';
import type { CaptureStatus } from '../recording/recorder';
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`<h1>Record your class</h1><p>Local recording spike. Processing and cloud upload are not connected yet.</p><p>Use headphones to reduce microphone bleed. Obtain your tutor's consent.</p><button id="preflight">Check microphone</button><label><input id="consent" type="checkbox"> Everyone in this class has agreed to recording</label><button id="record" disabled>Record class</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="stop">Stop</button><p id="state" role="status">Ready</p><label>Classroom audio<meter id="tab" min="0" max="1"></meter></label><label>Your microphone<meter id="microphone" min="0" max="1"></meter></label><p id="warning" class="warning"></p><section id="saved"></section>`;
const state=document.querySelector<HTMLElement>('#state')!;
const warning=document.querySelector<HTMLElement>('#warning')!;
const record=document.querySelector<HTMLButtonElement>('#record')!;
async function enable() {const {microphoneReady}=await chrome.storage.session.get('microphoneReady');record.disabled=!microphoneReady||!document.querySelector<HTMLInputElement>('#consent')!.checked;}
document.querySelector<HTMLInputElement>('#consent')!.onchange=()=>void enable();
chrome.storage.onChanged.addListener(()=>void enable());
document.querySelector<HTMLButtonElement>('#preflight')!.onclick=()=>void chrome.tabs.create({url:chrome.runtime.getURL('preflight.html')});
for(const action of ['record','pause','resume','stop']) document.querySelector<HTMLButtonElement>(`#${action}`)!.onclick=async()=>{
  warning.textContent='';try{const response=await chrome.runtime.sendMessage({target:'background',action});if(response.error) throw new Error(response.error);await showSaved();}catch(error){warning.textContent=(error as Error).message;}
};
chrome.runtime.onMessage.addListener(message=>{
  if(message.target!=='panel')return;
  const status=message.status as CaptureStatus;
  state.textContent=`${status.manifest.state} · ${Math.floor(status.manifest.durationMs/1000)} seconds saved on device · ${(status.manifest.bytes/1024/1024).toFixed(1)} MB`;
  warning.textContent=status.manifest.warning??'';
  for(const channel of ['tab','microphone'] as const) document.querySelector<HTMLMeterElement>(`#${channel}`)!.value=status.levels[channel];
  record.disabled=['recording','paused'].includes(status.manifest.state);
  if(['saved','interrupted'].includes(status.manifest.state))void showSaved();
});
async function showSaved(){
  const response=await chrome.runtime.sendMessage({target:'background',action:'status'});
  const saved=document.querySelector<HTMLElement>('#saved')!;saved.replaceChildren();
  for(const m of (response.result??[]) as RecordingManifest[]) {
    const article=document.createElement('article');const title=document.createElement('p');
    title.textContent=`${new Date(m.createdAt).toLocaleString()} — ${m.state} — ${(m.bytes/1048576).toFixed(1)} MB on device`;article.append(title);
    if(m.warning){const p=document.createElement('p');p.textContent=m.warning;article.append(p);}
    if(['saved','interrupted'].includes(m.state)) {
      const exportButton=document.createElement('button');exportButton.textContent='Export saved audio parts';
      exportButton.onclick=async()=>{try{for(const part of orderedParts(await fragmentsFor(m.id))){const first=part[0]!;const blob=new Blob(part.map(f=>f.blob),{type:first.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${m.id}-${first.channel}-${first.part}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}}catch(error){warning.textContent=(error as Error).message;}};
      const remove=document.createElement('button');remove.textContent='Delete local audio';remove.onclick=async()=>{if(confirm('Delete this recording from this device? This cannot be undone.')){await deleteLocal(m.id);await showSaved();}};article.append(exportButton,remove);
    }saved.append(article);
  }
}
void enable();void showSaved();
