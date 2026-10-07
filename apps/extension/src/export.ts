import './panel/style.css';
import {database,fragmentsFor,recoverInterrupted} from './recording/store';
import {orderedParts} from './recording/manifest';
const result=document.querySelector<HTMLPreElement>('#result')!;
document.querySelector<HTMLButtonElement>('#inspect')!.onclick=async()=>{
 const db=await database();const manifests=await db.getAll('manifests');const estimate=await navigator.storage.estimate();result.textContent=JSON.stringify({manifests,storage:{usageBytes:estimate.usage,quotaBytes:estimate.quota}},null,2);
};
document.querySelector<HTMLButtonElement>('#export')!.onclick=async()=>{
 const db=await database();const manifests=await db.getAll('manifests');const exported=[];
 for(const manifest of manifests){
  if(!['saved','interrupted'].includes(manifest.state))continue;
  for(const part of orderedParts(await fragmentsFor(manifest.id))){const first=part[0]!;const blob=new Blob(part.map(f=>f.blob),{type:first.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${manifest.id}-${first.channel}-${first.part}.webm`;a.textContent=a.download;document.body.append(a);exported.push({filename:a.download,bytes:blob.size});}
 }result.textContent=JSON.stringify({exported},null,2);
};

document.querySelector<HTMLButtonElement>('#upload')!.onclick=async()=>{
 try{
  const receipts=[];const db=await database();
  for(const manifest of await db.getAll('manifests')){
   if(!['saved','interrupted'].includes(manifest.state))continue;
   for(const part of orderedParts(await fragmentsFor(manifest.id))){
    const first=part[0]!;const blob=new Blob(part.map(f=>f.blob),{type:first.mimeType});
    const filename=`${manifest.id}-${first.channel}-${first.part}.webm`;
    const response=await fetch(`http://127.0.0.1:5183/${filename}`,{method:'POST',body:blob});
    if(!response.ok)throw new Error(`Local receiver failed: ${response.status}`);
    receipts.push(await response.json());
   }
  }result.textContent=JSON.stringify({localReceiverReceipts:receipts},null,2);
 }catch(error){result.textContent=String(error);}
};

document.querySelector<HTMLButtonElement>('#recover')!.onclick=async()=>{
 result.textContent=JSON.stringify({interrupted:await recoverInterrupted()},null,2);
};
