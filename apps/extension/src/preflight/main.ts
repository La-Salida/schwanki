import '../panel/style.css';
const status=document.querySelector<HTMLParagraphElement>('#status')!;
const meter=document.querySelector<HTMLMeterElement>('#meter')!;
let stream:MediaStream|undefined;let context:AudioContext|undefined;
document.querySelector<HTMLButtonElement>('#check')!.onclick=async()=>{
  try {
    stream?.getTracks().forEach(track=>track.stop());await context?.close();
    stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true}});
    context=new AudioContext();const analyser=context.createAnalyser();context.createMediaStreamSource(stream).connect(analyser);
    const samples=new Float32Array(analyser.fftSize);
    const frame=()=>{if(!context||context.state==='closed') return;analyser.getFloatTimeDomainData(samples);meter.value=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);requestAnimationFrame(frame);};frame();
    await chrome.storage.session.set({microphoneReady:true});status.textContent='Microphone enabled. Speak to check the meter, then close this tab and return to your classroom.';
  }catch(error){status.textContent=`Microphone unavailable: ${(error as Error).message}`;}
};
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(track=>track.stop());void context?.close();});
