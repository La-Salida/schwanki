import './style.css';
import type { RecordingManifest } from '../recording/manifest';
import type { CaptureStatus } from '../recording/recorder';

const WEB=import.meta.env.VITE_WEB_ORIGIN as string;
const LANGUAGES:Array<[string,string]>=[
  ['zh','Chinese'],['th','Thai'],['es','Spanish'],['fr','French'],['de','German'],['it','Italian'],['pt','Portuguese'],
  ['ja','Japanese'],['ko','Korean'],['ru','Russian'],['ar','Arabic'],['vi','Vietnamese'],['tr','Turkish'],['nl','Dutch'],
  ['pl','Polish'],['uk','Ukrainian'],['hi','Hindi'],['id','Indonesian'],['el','Greek'],['sv','Swedish'],['he','Hebrew'],['en','English'],
];
const TUTOR_NOTE="Hi! Is it okay if I record the audio of our lessons? I use it to make flashcards of what we cover. It stays private to me, and the audio is deleted once it's transcribed.";

const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`
<h1>Record this lesson</h1>
<p class="lede">Schwanki records your lesson, then turns what your tutor taught into flashcards in your Inbox.</p>
<div class="account" id="account"></div>
<section class="card" id="setup">
  <label><span class="label-text">Language you're learning</span><select id="language"></select></label>
  <div id="mic"></div>
  <label class="check"><input id="consent" type="checkbox"><span>My tutor knows this lesson is being recorded.</span></label>
  <div class="row" style="margin-bottom:12px"><button class="quiet" id="copy" type="button">Copy a message to ask your tutor</button></div>
  <button class="primary" id="record" type="button" disabled>Record lesson</button>
  <p class="hint" id="setup-hint" style="margin:10px 0 0">Wear headphones so your tutor's voice doesn't echo into your microphone.</p>
</section>
<section class="card" id="live" hidden>
  <div class="live"><span class="dot" aria-hidden="true"></span><span class="clock" id="clock">0:00</span><span id="live-state">Recording</span></div>
  <div class="meter"><span>Lesson</span><div class="bar"><span id="tab-level"></span></div></div>
  <div class="meter"><span>You</span><div class="bar"><span id="mic-level"></span></div></div>
  <p class="error" id="live-warning" role="status"></p>
  <div class="row"><button id="pause" type="button">Pause</button><button id="resume" type="button" hidden>Resume</button><button class="stop" id="stop" type="button">Stop and make cards</button></div>
  <p class="hint" style="margin:10px 0 0">You can close this panel. Recording keeps going until you stop it or close the lesson tab.</p>
</section>
<p class="error" id="error" role="alert"></p>
<section id="lessons-wrap" hidden><h2>Recent lessons</h2><div class="card" id="lessons"></div></section>`;

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const language=$<HTMLSelectElement>('language');
const consent=$<HTMLInputElement>('consent');
const record=$<HTMLButtonElement>('record');
const errorBox=$('error');
let micReady=false;
let signedIn=false;
let recording=false;

for(const [code,name] of LANGUAGES){const o=document.createElement('option');o.value=code;o.textContent=name;language.append(o);}

async function send<T=unknown>(action:string,extra:Record<string,unknown>={}):Promise<T> {
  const response=await chrome.runtime.sendMessage({target:'background',action,...extra});
  if(response?.error) throw new Error(response.error);
  return response?.result as T;
}
function showError(error:unknown){errorBox.textContent=error?(error as Error).message??String(error):'';}
function button(text:string,onClick:()=>void|Promise<void>,className=''){const b=document.createElement('button');b.type='button';b.textContent=text;if(className)b.className=className;b.onclick=async()=>{b.disabled=true;showError(null);try{await onClick();}catch(e){showError(e);}finally{b.disabled=false;}};return b;}
function link(text:string,href:string){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener';a.textContent=text;return a;}
function para(text:string,className=''){const p=document.createElement('p');p.textContent=text;if(className)p.className=className;return p;}
function clock(ms:number){const s=Math.floor(ms/1000);const h=Math.floor(s/3600);const m=Math.floor(s%3600/60);const ss=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${ss}`:`${m}:${ss}`;}

function updateRecordButton(){record.disabled=recording||!micReady||!consent.checked||!language.value;}

async function renderAccount(){
  const box=$('account');box.replaceChildren();
  const status=await send<{signedIn:boolean;email:string|null}>('auth-status');signedIn=status.signedIn;
  if(status.signedIn){box.append(para(`Signed in${status.email?` as ${status.email}`:''}`),button('Sign out',async()=>{await send('sign-out');await renderAccount();},'quiet'));}
  else{const wrap=document.createElement('div');wrap.append(para('Connect your Schwanki account so your lessons can become cards. You can still record without it and send later.'),button('Connect Schwanki account',()=>send('sign-in')));box.append(wrap);}
}

async function renderMic(){
  const box=$('mic');box.replaceChildren();
  try{micReady=(await navigator.permissions.query({name:'microphone' as PermissionName})).state==='granted';}catch{micReady=false;}
  if(!micReady){const {microphoneReady}=await chrome.storage.session.get('microphoneReady');micReady=Boolean(microphoneReady);}
  if(micReady) box.append(para('Microphone ready.','ok'));
  else box.append(para('Schwanki records your microphone too, so it knows which lines were yours.','hint'),button('Allow microphone',()=>void chrome.tabs.create({url:chrome.runtime.getURL('preflight.html')})));
  updateRecordButton();
}

function statusLine(m:RecordingManifest):{text:string;className?:string;actions:HTMLElement[]}{
  const u=m.upload;
  const retry=button('Send again',()=>send('upload',{id:m.id}));
  const remove=button('Delete',async()=>{if(confirm('Delete this recording from this computer? This cannot be undone.')){await send('delete',{id:m.id});await renderLessons();}},'quiet');
  if(m.state==='recording'||m.state==='paused') return {text:'Recording now.',actions:[]};
  if(!u||u.state==='waiting') return {text:'Saved on this computer.',actions:[retry,remove]};
  if(u.state==='uploading') return {text:'Sending to Schwanki…',actions:[]};
  if(u.state==='processing'){const paid=u.free?' This one was free.':u.cost?` Used ${u.cost} credit${u.cost===1?'':'s'}.`:'';return {text:`Sent. Your cards will be in the Inbox in a few minutes.${paid}`,actions:[link('Open Inbox',`${WEB}/inbox`)]};}
  if(u.state==='done') return {text:'Done. Your cards are in the Inbox.',className:'ok',actions:[link('Open Inbox',`${WEB}/inbox`),remove]};
  if(u.state==='signed_out') return {text:'Saved on this computer. Connect your account to send it.',actions:[button('Connect Schwanki account',()=>send('sign-in')),remove]};
  if(u.state==='no_credits') return {text:u.error??'You need more credits for this lesson.',className:'error',actions:[link('Buy credits',`${WEB}/billing`),retry,remove]};
  return {text:u.error??'Sending failed.',className:'error',actions:[retry,remove]};
}

async function renderLessons(){
  const manifests=((await send<RecordingManifest[]>('status'))??[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10);
  const list=$('lessons');list.replaceChildren();$('lessons-wrap').hidden=manifests.length===0;
  for(const m of manifests){
    const item=document.createElement('article');item.className='lesson';
    const title=document.createElement('p');title.className='lesson-title';
    const when=new Date(m.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const lang=LANGUAGES.find(([c])=>c===m.language)?.[1];
    title.textContent=`${when} · ${clock(m.durationMs)}${lang?` · ${lang}`:''}`;
    const s=statusLine(m);
    item.append(title,para(s.text,s.className??''));
    if(m.warning&&m.upload?.state!=='done'&&m.upload?.state!=='processing') item.append(para(m.warning,'hint'));
    if(s.actions.length){const row=document.createElement('div');row.className='row';row.append(...s.actions);item.append(row);}
    list.append(item);
  }
  const active=manifests.find(m=>m.state==='recording'||m.state==='paused');
  setRecording(Boolean(active),active?.state==='paused');
}

function setRecording(on:boolean,paused=false){
  recording=on;$('setup').hidden=on;$('live').hidden=!on;
  $('live').classList.toggle('paused',paused);$('live-state').textContent=paused?'Paused':'Recording';
  $('pause').hidden=paused;$('resume').hidden=!paused;updateRecordButton();
}

language.onchange=()=>{void chrome.storage.local.set({language:language.value});updateRecordButton();};
consent.onchange=updateRecordButton;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(TUTOR_NOTE);$('copy').textContent='Copied. Paste it in the lesson chat.';}catch{showError(new Error(`Couldn't copy. The message is: ${TUTOR_NOTE}`));}};
record.onclick=async()=>{showError(null);record.disabled=true;try{await send('record',{language:language.value});setRecording(true);consent.checked=false;}catch(e){showError(e);updateRecordButton();}};
for(const action of ['pause','resume','stop'] as const) $(action).onclick=async()=>{showError(null);try{await send(action);await renderLessons();}catch(e){showError(e);}};

chrome.runtime.onMessage.addListener(message=>{
  if(message.target!=='panel')return;
  if(message.action==='status'){
    const status=message.status as CaptureStatus;const m=status.manifest;
    if(m.state==='recording'||m.state==='paused'){
      setRecording(true,m.state==='paused');$('clock').textContent=clock(status.elapsedMs??m.durationMs);
      $('tab-level').style.width=`${Math.min(100,status.levels.tab*400)}%`;$('mic-level').style.width=`${Math.min(100,status.levels.microphone*400)}%`;
      $('live-warning').textContent=m.warning??'';
    } else void renderLessons();
  }
  if(message.action==='uploads-changed') void renderLessons();
  if(message.action==='auth-changed') void renderAccount().then(renderLessons);
});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.microphoneReady)void renderMic();});

void (async()=>{
  const {language:saved}=await chrome.storage.local.get('language');
  if(typeof saved==='string'&&LANGUAGES.some(([c])=>c===saved)) language.value=saved;
  await Promise.all([renderAccount(),renderMic()]);await renderLessons();
  void send('refresh').then(renderLessons).catch(()=>{});
})().catch(showError);
