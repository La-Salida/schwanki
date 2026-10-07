export type ItemKind='vocabulary'|'phrase'|'grammar'|'correction';
export interface TranscriptSegment {
 id:string;channel:'tab'|'microphone';startMs:number;endMs:number;text:string;
 speaker:string|null;uncertainty:{reason?:string;providerConfidence?:number};
}
export interface Transcript { revision:number;segments:TranscriptSegment[];gaps:Array<{startMs:number;endMs:number}> }
export interface Evidence { segmentId:string;quote:string }
export interface LessonItem {
 key:string;kind:ItemKind;targetText:string;front:string;back:string;
 generated:{translation?:string;reading?:string;explanation?:string};
 evidence:Evidence[];uncertain:boolean;
 original?:string;corrected?:string;
}
export interface LessonNote { text:string;evidence:Evidence[] }
export interface LessonResult {
 title:string;topics:LessonNote[];practiced:LessonNote[];explanations:LessonNote[];
 homework:LessonNote[];nextSteps:LessonNote[];items:LessonItem[];
}
export interface TranscriptionProvider {
 transcribe(media:Blob,options:{targetLanguage:string;explanationLanguage:string;signal:AbortSignal}):Promise<{segments:TranscriptSegment[];usage:Record<string,number>;model:string}>;
}
export interface ExtractionProvider { extract(prompt:string,signal:AbortSignal):Promise<unknown> }
