import type { TranscriptSegment } from './types.ts';
// Only assembled/remuxed complete containers may be passed to providers. Timeslice
// fragments are not independent files; transport acknowledgement is not decode proof.
export function alignTranscript(segments:TranscriptSegment[],part:{channel:'tab'|'microphone';startMs:number;durationMs:number;id:string}):TranscriptSegment[]{
 return segments.map((s,i)=>{
  if(s.startMs<0||s.endMs<s.startMs||s.endMs>part.durationMs+1000)throw new Error('Provider timestamp outside media part');
  return {...s,id:`${part.id}:${i}`,channel:part.channel,startMs:s.startMs+part.startMs,endMs:s.endMs+part.startMs,speaker:s.speaker??null};
 });
}
export function reconcileOverlap(segments:TranscriptSegment[]):TranscriptSegment[]{
 const output:TranscriptSegment[]=[];
 for(const segment of [...segments].sort((a,b)=>a.startMs-b.startMs||a.id.localeCompare(b.id))){
  if(output.some(previous=>previous.channel===segment.channel&&previous.text.trim()===segment.text.trim()&&Math.max(previous.startMs,segment.startMs)<Math.min(previous.endMs,segment.endMs)))continue;
  output.push(segment);
 }return output;
}
