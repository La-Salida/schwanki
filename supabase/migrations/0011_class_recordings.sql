-- Recorded classes share lesson batches and existing cards; processing writes are
-- service-only. Composite foreign keys enforce ownership even for service writes.
alter table sources drop constraint sources_type_check;
alter table sources add constraint sources_type_check check(type in ('google_sheet','google_doc','pdf_upload','preply_chat','manual','class_recording'));
alter table sources add unique(id,user_id);
alter table cards add unique(id,user_id);
alter table batches add unique(id,user_id);
alter table cards add column kind text not null default 'vocabulary' check(kind in ('vocabulary','phrase','grammar','correction'));
drop index cards_dedup_key;
create unique index cards_dedup_key on cards(user_id,language,kind,lower(btrim(front)));

create table class_recordings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid not null, client_key uuid not null, label text not null,
 target_language text not null, explanation_language text not null,
 status text not null default 'prepared' check(status in ('prepared','recording','uploading','queued','transcribing','extracting','ready','interrupted','failed','deleting','deleted')),
 started_at timestamptz, ended_at timestamptz, duration_ms bigint not null default 0 check(duration_ms>=0),
 limits jsonb not null, quote_expires_at timestamptz not null,
 retention_until timestamptz not null default now()+interval '7 days',
 completeness text not null default 'complete' check(completeness in ('complete','interrupted')),
 gaps jsonb not null default '[]', failure_stage text, error_detail text, deleted_at timestamptz,
 current_transcript_id uuid, current_notes_id uuid, created_at timestamptz not null default now(),
 unique(user_id,client_key), unique(id,user_id), unique(id,source_id),
 foreign key(source_id,user_id) references sources(id,user_id)
);
alter table class_recordings enable row level security;
create policy "read own recordings" on class_recordings for select using(auth.uid()=user_id and deleted_at is null);

create table class_recording_chunks (
 recording_id uuid not null,user_id uuid not null,channel text not null check(channel in ('tab','microphone')),
 part int not null check(part>=0),sequence int not null check(sequence>=0),
 start_ms bigint not null check(start_ms>=0),duration_ms bigint not null check(duration_ms>=0),
 bytes bigint not null check(bytes>0),checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 mime_type text not null check(mime_type in ('audio/webm','audio/webm;codecs=opus')),storage_path text not null unique,
 acknowledged_at timestamptz not null default now(),
 primary key(recording_id,channel,part,sequence),
 foreign key(recording_id,user_id) references class_recordings(id,user_id) on delete cascade
);
alter table class_recording_chunks enable row level security;
create policy "read own chunks" on class_recording_chunks for select using(auth.uid()=user_id and exists(select 1 from class_recordings r where r.id=recording_id and r.deleted_at is null));

create table class_transcripts (
 id uuid primary key default gen_random_uuid(),recording_id uuid not null,user_id uuid not null,
 revision int not null check(revision>0),provider text not null,model text not null,usage jsonb not null default '{}',
 created_at timestamptz not null default now(),unique(recording_id,revision),unique(id,recording_id,user_id),
 foreign key(recording_id,user_id) references class_recordings(id,user_id) on delete cascade
);
create table class_transcript_segments (
 id uuid primary key default gen_random_uuid(),transcript_id uuid not null,recording_id uuid not null,user_id uuid not null,
 ordinal int not null check(ordinal>=0),channel text not null check(channel in ('tab','microphone')),
 start_ms bigint not null check(start_ms>=0),end_ms bigint not null check(end_ms>=start_ms),
 speaker text,text text not null check(length(btrim(text))>0),uncertainty jsonb not null default '{}',
 unique(transcript_id,ordinal),unique(id,transcript_id,recording_id,user_id),
 foreign key(transcript_id,recording_id,user_id) references class_transcripts(id,recording_id,user_id) on delete cascade
);
create table class_note_revisions (
 id uuid primary key default gen_random_uuid(),transcript_id uuid not null,recording_id uuid not null,user_id uuid not null,
 revision int not null check(revision>0),notes jsonb not null,model text not null,prompt_version text not null,
 usage jsonb not null default '{}',created_at timestamptz not null default now(),
 unique(recording_id,revision),unique(id,transcript_id,recording_id,user_id),unique(id,recording_id,user_id),
 foreign key(transcript_id,recording_id,user_id) references class_transcripts(id,recording_id,user_id) on delete cascade
);
create table class_learning_items (
 id uuid primary key default gen_random_uuid(),notes_id uuid not null,transcript_id uuid not null,recording_id uuid not null,user_id uuid not null,
 item_key text not null,kind text not null check(kind in ('vocabulary','phrase','grammar','correction')),
 target_text text not null,front text not null,back text not null,
 generated jsonb not null default '{}',uncertain bool not null default false,
 unique(notes_id,item_key),unique(id,recording_id),unique(id,recording_id,user_id),unique(id,transcript_id,recording_id,user_id),
 foreign key(notes_id,transcript_id,recording_id,user_id) references class_note_revisions(id,transcript_id,recording_id,user_id) on delete cascade
);
create table class_item_evidence (
 item_id uuid not null,segment_id uuid not null,transcript_id uuid not null,recording_id uuid not null,user_id uuid not null,
 quote text not null check(length(btrim(quote))>0),primary key(item_id,segment_id),
 foreign key(item_id,transcript_id,recording_id,user_id) references class_learning_items(id,transcript_id,recording_id,user_id) on delete cascade,
 foreign key(segment_id,transcript_id,recording_id,user_id) references class_transcript_segments(id,transcript_id,recording_id,user_id) on delete cascade
);
-- Only validated processing transactions can create evidence. The trigger
-- rejects fabricated quotes; extraction validates target text before publication.
create function validate_class_evidence() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare segment_text text;
begin
 select text into segment_text from class_transcript_segments where id=new.segment_id;
 if position(new.quote in coalesce(segment_text,''))=0 then raise exception 'evidence quote absent from transcript';end if;
 return new;
end;$$;
create trigger check_class_evidence before insert or update on class_item_evidence for each row execute function validate_class_evidence();

-- A shared card keeps the evidence from every class that approved it. Removing
-- one recording removes its references while preserving the card and FSRS state.
create table card_class_evidence (
 card_id uuid not null,item_id uuid not null,recording_id uuid not null,user_id uuid not null,
 primary key(card_id,item_id),
 foreign key(card_id,user_id) references cards(id,user_id) on delete cascade,
 foreign key(item_id,recording_id,user_id) references class_learning_items(id,recording_id,user_id) on delete cascade
);
alter table card_class_evidence enable row level security;
create policy "read own card class evidence" on card_class_evidence for select using(auth.uid()=user_id and exists(select 1 from class_recordings r where r.id=recording_id and r.deleted_at is null));

-- Immutable revisions: client edits must create a new transcript revision via a
-- validated service operation, never mutate evidence behind an approved card.
alter table class_recordings add foreign key(current_transcript_id,id,user_id) references class_transcripts(id,recording_id,user_id) deferrable initially deferred;
alter table class_recordings add foreign key(current_notes_id,id,user_id) references class_note_revisions(id,recording_id,user_id) deferrable initially deferred;
do $$declare t text;begin
 foreach t in array array['class_transcripts','class_transcript_segments','class_note_revisions','class_learning_items','class_item_evidence'] loop
 execute format('alter table %I enable row level security',t);
 execute format('create policy "read own class output" on %I for select using(auth.uid()=user_id and exists(select 1 from class_recordings r where r.id=recording_id and r.deleted_at is null))',t);
 end loop;
end;$$;

alter table batches add column recording_id uuid unique references class_recordings(id) on delete cascade;
alter table batches add foreign key(recording_id,user_id) references class_recordings(id,user_id) on delete cascade;
alter table batches drop constraint batches_user_id_source_id_label_key;
create unique index batches_legacy_key on batches(user_id,source_id,label) where recording_id is null;
create table batch_cards (
 batch_id uuid not null,card_id uuid not null,user_id uuid not null,
 primary key(batch_id,card_id),foreign key(batch_id,user_id) references batches(id,user_id) on delete cascade,
 foreign key(card_id,user_id) references cards(id,user_id) on delete cascade
);
alter table batch_cards enable row level security;
create policy "read own batch cards" on batch_cards for select using(auth.uid()=user_id);
create policy "add own batch cards" on batch_cards for insert with check(auth.uid()=user_id);
insert into batch_cards(batch_id,card_id,user_id) select batch_id,id,user_id from cards where batch_id is not null on conflict do nothing;
-- Keep compatibility for listening's primary/origin batch while queries migrate.
create function link_primary_batch() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.batch_id is not null then insert into batch_cards(batch_id,card_id,user_id) values(new.batch_id,new.id,new.user_id) on conflict do nothing;end if;return new;
end;$$;
create trigger link_card_batch after insert or update of batch_id on cards for each row execute function link_primary_batch();

alter table candidate_cards add column recording_id uuid;
alter table candidate_cards add column learning_item_id uuid;
alter table candidate_cards add column kind text not null default 'vocabulary' check(kind in ('vocabulary','phrase','grammar','correction'));
alter table candidate_cards add column approved_card_id uuid references cards(id) on delete set null;
alter table candidate_cards add column user_edited bool not null default false;
alter table candidate_cards add foreign key(recording_id,source_id) references class_recordings(id,source_id) on delete cascade;
alter table candidate_cards add foreign key(learning_item_id,recording_id) references class_learning_items(id,recording_id) on delete cascade;
alter table candidate_cards add check((recording_id is null and learning_item_id is null) or (recording_id is not null and learning_item_id is not null));
create unique index class_candidate_item on candidate_cards(learning_item_id) where learning_item_id is not null;
drop policy "own candidates" on candidate_cards;
create policy "read own candidates" on candidate_cards for select using(exists(select 1 from sources s where s.id=source_id and s.user_id=auth.uid()));
create policy "insert legacy candidates" on candidate_cards for insert with check(recording_id is null and exists(select 1 from sources s where s.id=source_id and s.user_id=auth.uid()));
create policy "update legacy candidates" on candidate_cards for update using(recording_id is null and exists(select 1 from sources s where s.id=source_id and s.user_id=auth.uid())) with check(recording_id is null and exists(select 1 from sources s where s.id=source_id and s.user_id=auth.uid()));
create policy "delete legacy candidates" on candidate_cards for delete using(recording_id is null and exists(select 1 from sources s where s.id=source_id and s.user_id=auth.uid()));

create function approve_class_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c candidate_cards;r class_recordings;v_batch uuid;v_card uuid;v_created bool=false;
begin
 if auth.uid() is null then raise exception 'not signed in';end if;
 select * into c from candidate_cards where id=p_candidate_id for update;
 select * into r from class_recordings where id=c.recording_id and user_id=auth.uid() and deleted_at is null for update;
 if r.id is null then raise exception 'class candidate not found';end if;
 if c.status='discarded' then raise exception 'candidate discarded';end if;
 if not exists(select 1 from class_item_evidence where item_id=c.learning_item_id) then raise exception 'candidate has no validated evidence';end if;
 insert into batches(user_id,source_id,label,language,recording_id) values(r.user_id,r.source_id,r.label,r.target_language,r.id)
 on conflict(recording_id) do nothing;
 select id into v_batch from batches where recording_id=r.id;
 if c.status='approved' then
  select id into v_card from cards where id=c.approved_card_id and user_id=r.user_id;
  if v_card is null then raise exception 'approved card no longer exists';end if;
  insert into batch_cards(batch_id,card_id,user_id) values(v_batch,v_card,r.user_id) on conflict do nothing;
  insert into card_class_evidence(card_id,item_id,recording_id,user_id) values(v_card,c.learning_item_id,r.id,r.user_id) on conflict do nothing;
  return jsonb_build_object('cardId',v_card,'created',false,'batchId',v_batch);
 end if;
 insert into cards(user_id,source_id,language,kind,front,back,reading,example_sentence,batch_id)
 values(r.user_id,r.source_id,r.target_language,c.kind,c.front,c.back,c.reading,c.example_sentence,v_batch)
 on conflict(user_id,language,kind,lower(btrim(front))) do nothing returning id into v_card;
 v_created=v_card is not null;
 if v_card is null then select id into v_card from cards where user_id=r.user_id and language=r.target_language and kind=c.kind and lower(btrim(front))=lower(btrim(c.front));end if;
 insert into card_state(card_id,user_id,due_at,fsrs) values(v_card,r.user_id,now(),jsonb_build_object('due',now(),'stability',0,'difficulty',0,'elapsed_days',0,'scheduled_days',0,'reps',0,'lapses',0,'state',0)) on conflict(card_id) do nothing;
 insert into batch_cards(batch_id,card_id,user_id) values(v_batch,v_card,r.user_id) on conflict do nothing;
 insert into card_class_evidence(card_id,item_id,recording_id,user_id) values(v_card,c.learning_item_id,r.id,r.user_id) on conflict do nothing;
 update candidate_cards set status='approved',approved_card_id=v_card where id=c.id;
 return jsonb_build_object('cardId',v_card,'created',v_created,'batchId',v_batch);
end;$$;
revoke execute on function approve_class_candidate(uuid) from public,anon;
grant execute on function approve_class_candidate(uuid) to authenticated;

-- Parse workers must not claim unknown audio payloads. This isolates future
-- class processing jobs until the benchmark-selected worker is implemented.
create or replace function claim_llm_jobs(batch_size int) returns setof llm_jobs language sql as $$
 update llm_jobs set status='running',attempts=attempts+1 where id in (
 select id from llm_jobs where type='parse' and status='pending' and run_after<=now()
 order by created_at limit batch_size for update skip locked) returning *;
$$;

-- Class identities and memberships are controlled by the approval transaction.
-- Legacy listening clients keep their existing insert/update behavior.
alter table batches add foreign key(source_id,user_id) references sources(id,user_id);
drop policy "own batches" on batches;
create policy "read own batches" on batches for select using(auth.uid()=user_id);
create policy "insert legacy batches" on batches for insert with check(auth.uid()=user_id and recording_id is null);
create policy "update legacy batches" on batches for update using(auth.uid()=user_id and recording_id is null) with check(auth.uid()=user_id and recording_id is null);
create policy "delete legacy batches" on batches for delete using(auth.uid()=user_id and recording_id is null);
drop policy "add own batch cards" on batch_cards;
create policy "add legacy batch cards" on batch_cards for insert with check(auth.uid()=user_id and exists(select 1 from batches b where b.id=batch_id and b.recording_id is null));

create function edit_class_candidate(p_candidate_id uuid,p_front text,p_back text,p_reading text,p_discard bool default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c candidate_cards;r class_recordings;
begin
 select * into c from candidate_cards where id=p_candidate_id for update;
 select * into r from class_recordings where id=c.recording_id and user_id=auth.uid() and deleted_at is null for update;
 if r.id is null then raise exception 'class candidate not found';end if;
 if c.status='approved' and not p_discard and c.front is not distinct from p_front and c.back is not distinct from p_back and c.reading is not distinct from p_reading then return;end if;
 if c.status<>'pending' then raise exception 'resolved candidate cannot be edited';end if;
 if p_front is null or p_back is null or length(btrim(p_front))=0 or length(btrim(p_back))=0 or length(p_front)>10000 or length(p_back)>10000 or length(p_reading)>2000 then raise exception 'invalid card fields';end if;
 update candidate_cards set front=p_front,back=p_back,reading=p_reading,
 user_edited=user_edited or front is distinct from p_front or back is distinct from p_back or reading is distinct from p_reading,
 status=case when p_discard then 'discarded' else 'pending' end where id=c.id;
end;$$;
revoke execute on function edit_class_candidate(uuid,text,text,text,bool) from public,anon;
grant execute on function edit_class_candidate(uuid,text,text,text,bool) to authenticated;

-- Trigger entry points cannot be attached to attacker-controlled temporary tables.
revoke execute on function link_primary_batch() from public,anon,authenticated;
revoke execute on function validate_class_evidence() from public,anon,authenticated;
revoke execute on function claim_llm_jobs(int) from public,anon,authenticated;
grant execute on function claim_llm_jobs(int) to service_role;
