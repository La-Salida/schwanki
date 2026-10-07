import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { allowedExtension,handoffPayload } from '@/lib/extensionAuth';
interface ChromeMessaging { runtime?:{sendMessage:(id:string,message:unknown,callback:(response?:{ok?:boolean;error?:string})=>void)=>void;lastError?:{message?:string}} }
export default function ExtensionAuth(){
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('Connect the Schwanki extension to your signed-in account.');
 const id=new URLSearchParams(window.location.search).get('extensionId')??'';
 const allowed=allowedExtension(id,import.meta.env.VITE_EXTENSION_IDS??'');
 async function connect(){
  setBusy(true);
  try{
   if(!allowed)throw new Error('This extension ID is not approved in the web-app configuration.');
   const chrome=(window as Window&{chrome?:ChromeMessaging}).chrome;
   if(!chrome?.runtime)throw new Error('Open this page in Chrome with the Schwanki extension installed.');
   const {data,error}=await supabase.auth.refreshSession();if(error)throw error;if(!data.session)throw new Error('Sign into Schwanki first.');
   const payload=handoffPayload(data.session);
   await new Promise<void>((resolve,reject)=>chrome.runtime!.sendMessage(id,payload,response=>{
    if(chrome.runtime?.lastError||!response?.ok)reject(new Error(response?.error??chrome.runtime?.lastError?.message??'The extension did not accept the session.'));else resolve();
   }));
   setStatus('Connected. Return to your classroom and open the extension.');
  }catch(error){setStatus((error as Error).message);}finally{setBusy(false);}
 }
 return <main id="main-content" className="page-shell max-w-2xl"><header className="page-header"><h1>Connect your extension</h1><p>Use your Schwanki account in the Chrome extension.</p></header><p role="status" className="notice">{status}</p><p className="my-4 text-sm text-ink/70">The extension receives your Schwanki session so it can access your classes. Provider keys stay on the server.</p><button disabled={!allowed||busy} onClick={()=>void connect()} className="primary-button">{busy?'Connecting…':'Connect extension'}</button>{!allowed&&<p className="mt-4 text-sm text-ink/70">This development extension isn't configured for this app. Install the configured extension before connecting.</p>}</main>;
}
