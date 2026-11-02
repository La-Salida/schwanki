import '../panel/style.css';
const status=document.querySelector<HTMLParagraphElement>('#status')!;
const level=document.querySelector<HTMLSpanElement>('#level')!;
let stream:MediaStream|undefined;let context:AudioContext|undefined;
document.querySelector<HTMLButtonElement>('#check')!.onclick=async()=>{
  try {
    stream?.getTracks().forEach(track=>track.stop());await context?.close();
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true}});
    context=new AudioContext();const analyser=context.createAnalyser();context.createMediaStreamSource(stream).connect(analyser);
    const samples=new Float32Array(analyser.fftSize);
    const frame=()=>{if(!context||context.state==='closed') return;analyser.getFloatTimeDomainData(samples);level.style.width=`${Math.min(100,Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length)*400)}%`;requestAnimationFrame(frame);};frame();
    await chrome.storage.session.set({microphoneReady:true});
    status.className='ok';status.textContent='Microphone allowed. Say something to see the bar move, then close this tab and go back to your lesson.';
  }catch(error){status.className='error';status.textContent=`Chrome didn't allow the microphone: ${(error as Error).message}. Check the microphone icon in the address bar and try again.`;}
};
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(track=>track.stop());void context?.close();});
