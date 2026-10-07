import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateCardRow } from './types.ts';
export type CardKind='vocabulary'|'phrase'|'grammar'|'correction';
export interface ClassApproval { cardId:string; created:boolean; batchId:string }
export interface ClassRecording {
 id:string;sourceId:string;label:string;targetLanguage:string;explanationLanguage:string;
 status:'prepared'|'recording'|'uploading'|'transcribing'|'extracting'|'ready'|'failed'|'deleted';
 startedAt:string|null;durationMs:number;completeness:'complete'|'interrupted';
 failureStage:string|null;errorDetail:string|null;retentionUntil:string;
 currentTranscriptId:string|null;currentNotesId:string|null;
}
export class ClassApi {
 constructor(private db:SupabaseClient){}
 async approveCandidate(candidateId:string):Promise<ClassApproval>{
  const {data,error}=await this.db.rpc('approve_class_candidate',{p_candidate_id:candidateId});if(error)throw error;return data as ClassApproval;
 }
 async listRecordings():Promise<ClassRecording[]>{
  const {data,error}=await this.db.from('class_recordings').select('*').order('created_at',{ascending:false});if(error)throw error;
  return (data??[]).map(r=>({id:r.id,sourceId:r.source_id,label:r.label,targetLanguage:r.target_language,explanationLanguage:r.explanation_language,status:r.status,startedAt:r.started_at,durationMs:r.duration_ms,completeness:r.completeness,failureStage:r.failure_stage,errorDetail:r.error_detail,retentionUntil:r.retention_until,currentTranscriptId:r.current_transcript_id,currentNotesId:r.current_notes_id}));
 }
 async practiceCardIds(recordingId:string):Promise<string[]>{
  const {data:batch,error:batchError}=await this.db.from('batches').select('id').eq('recording_id',recordingId).maybeSingle();if(batchError)throw batchError;if(!batch)return [];
  const {data,error}=await this.db.from('batch_cards').select('card_id').eq('batch_id',batch.id);if(error)throw error;return(data??[]).map(r=>r.card_id);
 }
 async pendingCandidates(recordingId:string):Promise<CandidateCardRow[]>{
  const {data,error}=await this.db.from('candidate_cards').select('*, class_recordings(started_at)').eq('recording_id',recordingId).eq('status','pending').order('created_at');if(error)throw error;
  return(data??[]).map(r=>({id:r.id,sourceId:r.source_id,recordingId:r.recording_id,learningItemId:r.learning_item_id,kind:r.kind,front:r.front,back:r.back,rawContext:r.raw_context,status:r.status,confidence:r.confidence,createdAt:r.created_at,classStartedAt:r.class_recordings?.started_at??r.created_at,...(r.reading?{reading:r.reading}:{}),...(r.example_sentence?{exampleSentence:r.example_sentence}:{}),...(r.parse_notes?{parseNotes:r.parse_notes}:{})}));
 }
}
