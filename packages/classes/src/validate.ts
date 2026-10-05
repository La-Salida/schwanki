import { validateLanguage } from '@schwanki/parsing';
import type { Evidence, ItemKind, LessonItem, LessonNote, LessonResult, TranscriptSegment } from './types.ts';
const kinds:ItemKind[]=['vocabulary','phrase','grammar','correction'];
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected structured lesson output');return value as Record<string,unknown>;};
function string(value:unknown,label:string,max=10000):string{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`Invalid ${label}`);return value;}
function array(value:unknown,label:string,max=500):unknown[]{if(!Array.isArray(value)||value.length>max)throw new Error(`Invalid ${label}`);return value;}
export function validateTranscript(segments:TranscriptSegment[]):TranscriptSegment[]{
 const ids=new Set<string>();if(!segments.length)throw new Error('No speech found. Check both input channels.');
 for(const segment of segments){
  string(segment.id,'segment ID',200);string(segment.text,'transcript text');
  const uncertainty=object(segment.uncertainty);if(uncertainty.reason!==undefined)string(uncertainty.reason,'uncertain speech reason');
  if(uncertainty.providerConfidence!==undefined&&(typeof uncertainty.providerConfidence!=='number'||!Number.isFinite(uncertainty.providerConfidence)||uncertainty.providerConfidence<0||uncertainty.providerConfidence>1))throw new Error('Invalid provider confidence');
  if(segment.speaker!==null&&typeof segment.speaker!=='string')throw new Error('Invalid speaker label');
  if(ids.has(segment.id))throw new Error('Duplicate transcript segment ID');ids.add(segment.id);
  if(!['tab','microphone'].includes(segment.channel)||!Number.isFinite(segment.startMs)||!Number.isFinite(segment.endMs)||segment.startMs<0||segment.endMs<segment.startMs)throw new Error('Invalid transcript timing or channel');
 }
 return segments;
}
export function validateLesson(value:unknown,segments:TranscriptSegment[],targetLanguage?:string):LessonResult {
 validateTranscript(segments);const source=new Map(segments.map(s=>[s.id,s]));const root=object(value);
 function evidence(value:unknown):Evidence[]{
  return array(value,'evidence',100).map(raw=>{const e=object(raw);const segmentId=string(e.segmentId,'evidence ID',200);const quote=string(e.quote,'evidence quote');const segment=source.get(segmentId);if(!segment||!segment.text.includes(quote))throw new Error('Evidence is not present in the transcript');return {segmentId,quote};});
 }
 function notes(value:unknown):LessonNote[]{return array(value,'note list').map(raw=>{const n=object(raw);const refs=evidence(n.evidence);if(!refs.length)throw new Error('Lesson note has no evidence');return{text:string(n.text,'lesson note'),evidence:refs};});}
 const keys=new Set<string>();
 const items=array(root.items,'learning items').map(raw=>{
  const item=object(raw);const kind=string(item.kind,'kind') as ItemKind;if(!kinds.includes(kind))throw new Error('Unsupported card kind');
  const key=string(item.key,'item key',200);if(keys.has(key))throw new Error('Duplicate learning item key');keys.add(key);
  const targetText=string(item.targetText,'target text');
  if(targetLanguage&&!validateLanguage(targetText,targetLanguage.toLowerCase().split('-')[0]!))throw new Error('Target text does not match the class language');
  const refs=evidence(item.evidence);
  if(!refs.length||!refs.some(ref=>ref.quote.includes(targetText)))throw new Error('Target text is not supported by quoted evidence');
  const generated=object(item.generated);const g:LessonItem['generated']={};
  for(const field of ['translation','reading','explanation'] as const)if(generated[field]!==undefined)g[field]=string(generated[field],`generated ${field}`);
  if(typeof item.uncertain!=='boolean')throw new Error('Missing review uncertainty flag');
  const result:LessonItem={key,kind,targetText,front:string(item.front,'front'),back:string(item.back,'back'),generated:g,evidence:refs,uncertain:item.uncertain||refs.some(ref=>!!source.get(ref.segmentId)!.uncertainty.reason)};
  if(kind==='correction'){
   const original=string(item.original,'original learner utterance');const corrected=string(item.corrected,'corrected utterance');
   if(!refs.some(ref=>source.get(ref.segmentId)!.channel==='microphone'&&ref.quote.includes(original))||!refs.some(ref=>source.get(ref.segmentId)!.channel==='tab'&&ref.quote.includes(corrected)))throw new Error('Correction lacks original and remote correction evidence');
   result.original=original;result.corrected=corrected;
   // Channel identity cannot establish that an unknown remote speaker is the tutor.
   if(refs.some(ref=>source.get(ref.segmentId)!.channel==='tab'&&!source.get(ref.segmentId)!.speaker))result.uncertain=true;
  }
  return result;
 });
 return {title:string(root.title,'title',300),topics:notes(root.topics),practiced:notes(root.practiced),explanations:notes(root.explanations),homework:notes(root.homework),nextSteps:notes(root.nextSteps),items};
}
