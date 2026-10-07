import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const db=new PGlite();
const uid='10000000-0000-0000-0000-000000000001';
const other='10000000-0000-0000-0000-000000000002';
let source:string;
const sqlFile=(file:string)=>readFileSync(new URL(`../../../supabase/migrations/${file}`,import.meta.url),'utf8');
async function scalar<T>(sql:string,params:unknown[]=[]):Promise<T>{return(await db.query<{value:T}>(sql,params)).rows[0]!.value;}
beforeAll(async()=>{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(sqlFile('0001_initial.sql').replace('create extension if not exists pgcrypto;',''));
 await db.exec(sqlFile('0010_batch_listening.sql'));
 await db.exec(sqlFile('0011_class_recordings.sql'));
 await db.exec(sqlFile('0012_class_candidate_text.sql'));
 await db.exec(`grant usage on schema public,auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;insert into auth.users values('${uid}'),('${other}');select set_config('request.jwt.claim.sub','${uid}',false);`);
 source=await scalar<string>(`insert into sources(user_id,type,external_ref,label,language) values($1,'class_recording','tutor','Teacher','zh') returning id as value`,[uid]);
},30000);
afterAll(()=>db.close());
async function recording(label='Class',owner=uid,sourceId=source){return scalar<string>(`insert into class_recordings(user_id,source_id,client_key,label,target_language,explanation_language,limits,quote_expires_at) values($1,$2,gen_random_uuid(),$3,'zh','en','{}',now()+interval '1 hour') returning id as value`,[owner,sourceId,label]);}
async function candidate(recordingId:string,kind='vocabulary',front='虽然') {
 const transcript=await scalar<string>(`insert into class_transcripts(recording_id,user_id,revision,provider,model) values($1,$2,1,'fixture','fixture') returning id as value`,[recordingId,uid]);
 const segment=await scalar<string>(`insert into class_transcript_segments(transcript_id,recording_id,user_id,ordinal,channel,start_ms,end_ms,text) values($1,$2,$3,0,'tab',0,1000,'虽然 means although') returning id as value`,[transcript,recordingId,uid]);
 const notes=await scalar<string>(`insert into class_note_revisions(transcript_id,recording_id,user_id,revision,notes,model,prompt_version) values($1,$2,$3,1,'{}','fixture','v1') returning id as value`,[transcript,recordingId,uid]);
 const item=await scalar<string>(`insert into class_learning_items(notes_id,transcript_id,recording_id,user_id,item_key,kind,target_text,front,back) values($1,$2,$3,$4,'one',$5,'虽然',$6,'although') returning id as value`,[notes,transcript,recordingId,uid,kind,front]);
 await db.query(`insert into class_item_evidence(item_id,segment_id,transcript_id,recording_id,user_id,quote) values($1,$2,$3,$4,$5,'虽然')`,[item,segment,transcript,recordingId,uid]);
 return scalar<string>(`insert into candidate_cards(source_id,recording_id,learning_item_id,kind,front,back,raw_context) values($1,$2,$3,$4,$5,'although','虽然 means although') returning id as value`,[source,recordingId,item,kind,front]);
}
type Approval={cardId:string;created:boolean;batchId:string};
const approve=(id:string)=>scalar<Approval>('select approve_class_candidate($1) as value',[id]);
describe('recorded-class PostgreSQL contracts',()=>{
 it('reuses a reviewed word in two same-day class practice sets without resetting FSRS',async()=>{
  const a=await candidate(await recording());const b=await candidate(await recording());
  const first=await approve(a);await db.query('update card_state set reps=12,stability=44 where card_id=$1',[first.cardId]);
  const second=await approve(b);expect(first.created).toBe(true);expect(second.created).toBe(false);expect(second.cardId).toBe(first.cardId);expect(second.batchId).not.toBe(first.batchId);
  expect(await scalar<number>('select reps as value from card_state where card_id=$1',[first.cardId])).toBe(12);
  expect(await scalar<number>('select count(*)::int as value from batch_cards where card_id=$1',[first.cardId])).toBe(2);
  expect(await scalar<number>('select count(*)::int as value from card_class_evidence where card_id=$1',[first.cardId])).toBe(2);
  const replay=await approve(b);expect(replay).toEqual(second);
  expect(await scalar<number>('select count(*)::int as value from card_class_evidence where card_id=$1',[first.cardId])).toBe(2);
 });
 it('approval replay preserves an approved card renamed by the learner',async()=>{
  const c=await candidate(await recording(),'phrase','rename before');const first=await approve(c);await db.query('update cards set front=$1 where id=$2',['rename after',first.cardId]);
  const replay=await approve(c);expect(replay).toEqual({...first,created:false});expect(await scalar<number>(`select count(*)::int as value from cards where front='rename before'`)).toBe(0);
 });
 it('keeps grammar and vocabulary cards with identical fronts distinct',async()=>{
  const a=await approve(await candidate(await recording(),'grammar'));
  expect(a.created).toBe(true);expect(await scalar<number>(`select count(*)::int as value from cards where front='虽然'`)).toBe(2);
 });
 it('serializes repeated approval to one card and membership',async()=>{
  const c=await candidate(await recording(),'phrase','虽然 repeated');const results=await Promise.all([approve(c),approve(c),approve(c)]);
  expect(new Set(results.map(r=>r.cardId)).size).toBe(1);expect(results.filter(r=>r.created)).toHaveLength(1);
  expect(await scalar<number>('select count(*)::int as value from batch_cards where batch_id=$1',[results[0]!.batchId])).toBe(1);
 });
 it('rejects foreign-user parent links even through service writes',async()=>{
  await expect(recording('Foreign',other)).rejects.toThrow('foreign key');
 });
 it('rejects evidence links to another owner or another class',async()=>{
  const r=await recording();const c=await candidate(r,'phrase','evidence ownership');const approved=await approve(c);
  const item=await scalar<string>('select learning_item_id as value from candidate_cards where id=$1',[c]);
  const another=await recording();
  await expect(db.query('update card_class_evidence set user_id=$1 where card_id=$2 and item_id=$3',[other,approved.cardId,item])).rejects.toThrow('foreign key');
  await expect(db.query('update card_class_evidence set recording_id=$1 where card_id=$2 and item_id=$3',[another,approved.cardId,item])).rejects.toThrow('foreign key');
 });
 it('enforces RLS for reads and disallows direct processing output writes',async()=>{
  const c=await candidate(await recording());
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`);
  try{expect(await scalar<number>('select count(*)::int as value from class_recordings')).toBe(0);expect(await scalar<number>('select count(*)::int as value from card_class_evidence')).toBe(0);await expect(approve(c)).rejects.toThrow('not found');
   await expect(db.query(`insert into class_recordings(user_id,source_id,client_key,label,target_language,explanation_language,limits,quote_expires_at) values($1,$2,gen_random_uuid(),'x','zh','en','{}',now())`,[other,source])).rejects.toThrow('row-level security');
  }finally{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid}',false);`);}
 });
 it('rolls approval back when FSRS state creation fails',async()=>{
  const c=await candidate(await recording(),'correction','rollback');
  await db.exec(`create function fail_state() returns trigger language plpgsql as $$begin raise exception 'fixture state failure';end;$$;create trigger fail_state before insert on card_state for each row execute function fail_state();`);
  try{await expect(approve(c)).rejects.toThrow('fixture state failure');expect(await scalar<number>(`select count(*)::int as value from cards where front='rollback'`)).toBe(0);expect(await scalar<string>('select status as value from candidate_cards where id=$1',[c])).toBe('pending');}
  finally{await db.exec('drop trigger fail_state on card_state;drop function fail_state();');}
 });
 it('rolls approval back when class membership creation fails',async()=>{
  const r=await recording();const c=await candidate(r,'phrase','membership rollback');
  await db.exec(`create function fail_membership() returns trigger language plpgsql as $$begin raise exception 'fixture membership failure';end;$$;create trigger fail_membership before insert on batch_cards for each row execute function fail_membership();`);
  try{await expect(approve(c)).rejects.toThrow('fixture membership failure');expect(await scalar<number>('select count(*)::int as value from batches where recording_id=$1',[r])).toBe(0);expect(await scalar<number>(`select count(*)::int as value from cards where front='membership rollback'`)).toBe(0);expect(await scalar<string>('select status as value from candidate_cards where id=$1',[c])).toBe('pending');}
  finally{await db.exec('drop trigger fail_membership on batch_cards;drop function fail_membership();');}
 });
 it('rejects cross-class evidence and result pointers',async()=>{
  const a=await recording();const b=await recording();const ac=await candidate(a,'phrase','first class');const bc=await candidate(b,'phrase','second class');
  const first=(await db.query<{item:string;transcript:string}>('select learning_item_id as item,(select transcript_id from class_learning_items where id=learning_item_id) as transcript from candidate_cards where id=$1',[ac])).rows[0]!;
  const second=(await db.query<{segment:string;notes:string}>('select (select segment_id from class_item_evidence where item_id=learning_item_id) as segment,(select notes_id from class_learning_items where id=learning_item_id) as notes from candidate_cards where id=$1',[bc])).rows[0]!;
  await expect(db.query(`insert into class_item_evidence(item_id,segment_id,transcript_id,recording_id,user_id,quote) values($1,$2,$3,$4,$5,'虽然')`,[first.item,second.segment,first.transcript,a,uid])).rejects.toThrow('foreign key');
  await expect(db.query('update class_recordings set current_notes_id=$1 where id=$2',[second.notes,a])).rejects.toThrow('foreign key');
 });
 it('rejects evidence quotes absent from the immutable transcript',async()=>{
  const c=await candidate(await recording(),'correction','evidence');
  await expect(db.query(`update class_item_evidence set quote='fabricated' where item_id=(select learning_item_id from candidate_cards where id=$1)`,[c])).rejects.toThrow('quote absent');
 });
 it('retains learner edits and accepts an unchanged approval retry',async()=>{
  const c=await candidate(await recording(),'grammar','edit original');
  await db.query('select edit_class_candidate($1,$2,$3,null)',[c,'Edited prompt','Edited answer']);
  expect(await scalar<boolean>('select user_edited as value from candidate_cards where id=$1',[c])).toBe(true);
  await approve(c);
  await db.query('select edit_class_candidate($1,$2,$3,null)',[c,'Edited prompt','Edited answer']);
  await expect(db.query('select edit_class_candidate($1,$2,$3,null)',[c,'Different prompt','Edited answer'])).rejects.toThrow('resolved candidate');
 });
 it('saves all editor fields through class ownership checks and retains examples at approval',async()=>{
  const c=await candidate(await recording(),'phrase','editor');
  await db.query('select edit_class_candidate_text($1,$2,$3,$4,$5)',[c,'明显','obvious','míng xiǎn','变化很明显。']);
  expect(await scalar<boolean>('select user_edited as value from candidate_cards where id=$1',[c])).toBe(true);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[other]);
  try{await expect(db.query('select edit_class_candidate_text($1,$2,$3,null,null)',[c,'stolen','wrong'])).rejects.toThrow('not found');}
  finally{await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);}
  const approved=await approve(c);
  expect(await scalar<string>('select example_sentence as value from cards where id=$1',[approved.cardId])).toBe('变化很明显。');
  await expect(db.query('select edit_class_candidate_text($1,$2,$3,$4,null)',[c,'明显','obvious','míng xiǎn'])).rejects.toThrow('resolved candidate');
 });
 it('does not publish an approval for a tombstoned recording',async()=>{
  const r=await recording();const c=await candidate(r);await db.query(`update class_recordings set deleted_at=now(),status='deleted' where id=$1`,[r]);await expect(approve(c)).rejects.toThrow('not found');
 });
});
