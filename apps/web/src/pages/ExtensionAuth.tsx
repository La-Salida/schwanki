import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { allowedExtension,handoffPayload } from '@/lib/extensionAuth';
interface ChromeMessaging { runtime?:{sendMessage:(id:string,message:unknown,callback:(response?:{ok?:boolean;error?:string})=>void)=>void;lastError?:{message?:string}} }
export default function ExtensionAuth(){
 const [status,setStatus]=useState('Connect the Schwanki extension to your signed-in account.');
 const id=new URLSearchParams(window.location.search).get('extensionId')??'';
 const allowed=allowedExtension(id,import.meta.env.VITE_EXTENSION_IDS??'');
 async function connect(){
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
  }catch(error){setStatus((error as Error).message);}
 }
 return <main className="mx-auto max-w-xl p-6 space-y-4"><h1 className="text-2xl font-bold">Connect Chrome extension</h1><p role="status">{status}</p><p className="text-sm">The extension receives your Schwanki session so it can access your classes. Provider keys stay on the server.</p><button disabled={!allowed} onClick={()=>void connect()} className="rounded-lg bg-ink px-4 py-2 text-cream disabled:opacity-50">Connect extension</button>{!allowed&&<p>Install the development extension and configure its ID in VITE_EXTENSION_IDS before connecting.</p>}</main>;
}
