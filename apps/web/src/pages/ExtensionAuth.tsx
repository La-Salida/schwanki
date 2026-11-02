import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { allowedExtension,handoffPayload } from '@/lib/extensionAuth';
interface ChromeMessaging { runtime?:{sendMessage:(id:string,message:unknown,callback:(response?:{ok?:boolean;error?:string})=>void)=>void;lastError?:{message?:string}} }

export default function ExtensionAuth(){
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(false);
 const [status,setStatus]=useState<string|null>(null);
 const id=new URLSearchParams(window.location.search).get('extensionId')??'';
 const allowed=allowedExtension(id,import.meta.env.VITE_EXTENSION_IDS??'');
 async function connect(){
  setBusy(true);setStatus(null);
  try{
   const chrome=(window as Window&{chrome?:ChromeMessaging}).chrome;
   if(!chrome?.runtime)throw new Error('Open this page in Chrome, with the Schwanki extension installed.');
   const {data,error}=await supabase.functions.invoke('lesson-recording',{body:{action:'link'}});
   if(error||!data?.tokenHash)throw new Error(data?.error??"Couldn't connect the extension. Try again.");
   const payload=handoffPayload(data.tokenHash);
   await new Promise<void>((resolve,reject)=>chrome.runtime!.sendMessage(id,payload,response=>{
    if(chrome.runtime?.lastError||!response?.ok)reject(new Error(response?.error??"The extension didn't answer. Make sure it's installed and turned on, then try again."));else resolve();
   }));
   setDone(true);
  }catch(error){setStatus((error as Error).message);}finally{setBusy(false);}
 }
 if(done)return <main id="main-content" className="page-shell max-w-2xl"><header className="page-header"><h1>Extension connected</h1><p>Go back to your lesson tab and record from the Schwanki panel. You can close this tab.</p></header></main>;
 return <main id="main-content" className="page-shell max-w-2xl">
  <header className="page-header"><h1>Connect the lesson recorder</h1><p>Lets the Schwanki Chrome extension send your recorded lessons to your account.</p></header>
  {allowed
   ?<button disabled={busy} onClick={()=>void connect()} className="primary-button">{busy?'Connecting…':'Connect extension'}</button>
   :<p className="error-notice">This link didn't come from the Schwanki extension. Open the extension and choose Connect Schwanki account.</p>}
  {status&&<p role="alert" className="error-notice mt-4">{status}</p>}
  <p className="mt-6 text-sm text-ink/70">The extension gets its own sign-in, separate from this page. Sign out in the extension any time.</p>
 </main>;
}
