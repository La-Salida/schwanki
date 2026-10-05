-- Recorded-class contracts. No processing jobs or production storage writes yet.
-- 0010 is the next committed migration after origin/main's 0009; local listening
-- drafts are not reservations. batch_cards is the shared practice membership.
begin;

alter table sources drop constraint sources_type_check;
alter table sources add constraint sources_type_check check
  (type in ('google_sheet','google_doc','pdf_upload','preply_chat','manual','class_recording'));
alter table sources add constraint sources_id_owner_unique unique (id, user_id);
alter table cards add column kind text not null default 'vocabulary'
  check (kind in ('vocabulary','phrase','grammar','correction'));
drop index cards_dedup_key;
create unique index cards_dedup_key on cards(user_id, language, kind, lower(btrim(front)));
alter table cards add constraint cards_id_owner_unique unique (id, user_id);
alter table cards add constraint cards_source_owner_fk foreign key (source_id, user_id)
  references sources(id, user_id) on delete set null (source_id);
alter table card_state add constraint card_state_card_owner_fk foreign key (card_id, user_id)
  references cards(id, user_id) on delete cascade;

create table class_recordings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid,
  label text not null,
  target_language text not null,
  explanation_language text not null,
  state text not null default 'prepared' check (state in
    ('prepared','recording','uploading','queued','transcribing','extracting','ready','interrupted','failed','deleting','deleted')),
  quote jsonb not null,
  max_duration_ms bigint not null check (max_duration_ms > 0),
  max_bytes bigint not null check (max_bytes > 0),
  max_authorized_credits bigint not null check (max_authorized_credits >= 0),
  prepared_until timestamptz not null,
  consent_acknowledged_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms bigint check (duration_ms >= 0),
  capture_manifest jsonb check (capture_manifest is null or jsonb_typeof(capture_manifest) = 'object'),
  completeness_flags text[] not null default '{}',
  failure_stage text check (failure_stage in ('upload','remux','transcription','extraction','cleanup')),
  failure_code text,
  retention_deadline timestamptz,
  deleted_at timestamptz,
  processing_generation bigint not null default 0 check (processing_generation >= 0),
  derived_stale boolean not null default false,
  current_transcript_id uuid,
  current_note_revision_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, source_id),
  foreign key (source_id, user_id) references sources(id, user_id) on delete set null (source_id),
  check ((state in ('deleting','deleted')) = (deleted_at is not null))
);
create index class_recordings_owner_created on class_recordings(user_id, created_at desc);

create table class_recording_chunks (
  recording_id uuid not null,
  user_id uuid not null,
  channel text not null check (channel in ('tab','microphone')),
  part integer not null check (part >= 0),
  sequence integer not null check (sequence >= 0),
  start_ms bigint not null check (start_ms >= 0),
  duration_ms bigint not null check (duration_ms >= 0),
  bytes bigint not null check (bytes > 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  mime_type text not null,
  storage_path text not null unique,
  acknowledged_at timestamptz,
  primary key (recording_id, channel, part, sequence),
  foreign key (recording_id, user_id) references class_recordings(id, user_id) on delete cascade,
  check (storage_path = user_id::text || '/' || recording_id::text || '/' || channel || '/' || part || '/' || sequence)
);

create table class_transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null,
  user_id uuid not null,
  revision integer not null check (revision > 0),
  provider text not null,
  model text not null,
  processing_generation bigint not null default 0,
  usage jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (recording_id, revision),
  unique (id, recording_id, user_id),
  foreign key (recording_id, user_id) references class_recordings(id, user_id) on delete cascade
);
create table class_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null,
  recording_id uuid not null,
  user_id uuid not null,
  sequence integer not null check (sequence >= 0),
  channel text not null check (channel in ('tab','microphone')),
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms >= start_ms),
  speaker_label text,
  text text not null check (length(btrim(text)) > 0),
  uncertainty jsonb not null default '{}',
  unique (transcript_id, sequence),
  unique (id, transcript_id, recording_id, user_id),
  foreign key (transcript_id, recording_id, user_id) references class_transcripts(id, recording_id, user_id) on delete cascade
);
create table class_note_revisions (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null,
  transcript_id uuid not null,
  user_id uuid not null,
  revision integer not null check (revision > 0),
  prompt_version text not null,
  model text not null,
  processing_generation bigint not null default 0,
  notes jsonb not null,
  usage jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (recording_id, revision),
  unique (id, recording_id, user_id),
  foreign key (transcript_id, recording_id, user_id) references class_transcripts(id, recording_id, user_id) on delete cascade
);
alter table class_recordings add constraint class_current_transcript_fk
  foreign key (current_transcript_id, id, user_id) references class_transcripts(id, recording_id, user_id);
alter table class_recordings add constraint class_current_notes_fk
  foreign key (current_note_revision_id, id, user_id) references class_note_revisions(id, recording_id, user_id);

create table class_learning_items (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null,
  user_id uuid not null,
  note_revision_id uuid not null,
  kind text not null check (kind in ('vocabulary','phrase','grammar','correction')),
  target_text text not null check (length(btrim(target_text)) > 0),
  evidence_content jsonb not null, -- what was said, kept distinct from generated fields
  generated_content jsonb not null, -- translation/reading/explanation, explicitly generated
  review_flags text[] not null default '{}',
  unique (id, recording_id, user_id),
  foreign key (note_revision_id, recording_id, user_id) references class_note_revisions(id, recording_id, user_id) on delete cascade
);
create table class_learning_item_evidence (
  learning_item_id uuid not null,
  segment_id uuid not null,
  transcript_id uuid not null,
  recording_id uuid not null,
  user_id uuid not null,
  quote text not null check (length(btrim(quote)) > 0),
  primary key (learning_item_id, segment_id, quote),
  foreign key (learning_item_id, recording_id, user_id) references class_learning_items(id, recording_id, user_id) on delete cascade,
  foreign key (segment_id, transcript_id, recording_id, user_id) references class_transcript_segments(id, transcript_id, recording_id, user_id) on delete cascade
);
create function validate_class_evidence() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from class_transcript_segments s
    join class_learning_items i on i.id = new.learning_item_id
    join class_note_revisions n on n.id = i.note_revision_id
    where s.id = new.segment_id and s.transcript_id = n.transcript_id
      and s.transcript_id = new.transcript_id and strpos(s.text, new.quote) > 0
  ) then raise exception 'Evidence must quote a segment of this extraction transcript' using errcode = '23514'; end if;
  return new;
end $$;
create trigger class_evidence_validated before insert or update on class_learning_item_evidence
  for each row execute function validate_class_evidence();

create table batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid,
  recording_id uuid unique,
  label text not null,
  language text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (source_id, user_id) references sources(id, user_id) on delete set null (source_id),
  foreign key (recording_id, user_id) references class_recordings(id, user_id) on delete cascade,
  foreign key (recording_id, source_id) references class_recordings(id, source_id) on update cascade
);
create table batch_cards (
  batch_id uuid not null,
  card_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (batch_id, card_id),
  foreign key (batch_id, user_id) references batches(id, user_id) on delete cascade,
  foreign key (card_id, user_id) references cards(id, user_id) on delete cascade
);
create index batch_cards_card on batch_cards(card_id);
create table card_class_evidence (
  card_id uuid not null,
  learning_item_id uuid not null,
  recording_id uuid not null,
  user_id uuid not null,
  primary key (card_id, learning_item_id),
  foreign key (card_id, user_id) references cards(id, user_id) on delete cascade,
  foreign key (learning_item_id, recording_id, user_id) references class_learning_items(id, recording_id, user_id) on delete cascade
);

alter table candidate_cards add column user_id uuid references auth.users(id) on delete cascade;
update candidate_cards c set user_id = s.user_id from sources s where s.id = c.source_id;
alter table candidate_cards add column recording_id uuid;
alter table candidate_cards add column learning_item_id uuid;
alter table candidate_cards add column approved_card_id uuid;
alter table candidate_cards add column user_edited boolean not null default false;
alter table candidate_cards add column kind text not null default 'vocabulary'
  check (kind in ('vocabulary','phrase','grammar','correction'));
alter table candidate_cards add constraint candidate_class_item_required check
  ((recording_id is null and learning_item_id is null) or (recording_id is not null and learning_item_id is not null and user_id is not null));
alter table candidate_cards add constraint candidate_source_owner_fk foreign key (source_id, user_id)
  references sources(id, user_id) on delete set null (source_id);
alter table candidate_cards add constraint candidate_recording_source_fk foreign key (recording_id, source_id)
  references class_recordings(id, source_id) on update cascade;
alter table candidate_cards add constraint candidate_recording_owner_fk foreign key (recording_id, user_id)
  references class_recordings(id, user_id) on delete cascade;
alter table candidate_cards add constraint candidate_item_owner_fk foreign key (learning_item_id, recording_id, user_id)
  references class_learning_items(id, recording_id, user_id) on delete cascade;
alter table candidate_cards add constraint candidate_approved_card_owner_fk foreign key (approved_card_id, user_id)
  references cards(id, user_id) on delete set null (approved_card_id);
create unique index candidate_class_item_unique on candidate_cards(learning_item_id) where learning_item_id is not null;
create index candidate_recording_inbox on candidate_cards(recording_id, status);

-- Parent composite FKs apply even to service-role writes. Clients can read their
-- own processing output but cannot publish jobs, transcripts or extraction data.
do $$ declare t text; begin
  foreach t in array array['class_recordings','class_recording_chunks','class_transcripts','class_transcript_segments',
    'class_note_revisions','class_learning_items','class_learning_item_evidence','batches','batch_cards','card_class_evidence'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy owner_read on %I for select to authenticated using (user_id = auth.uid())', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

create function guard_class_candidate_write() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user not in ('anon','authenticated') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    if old.recording_id is not null then raise exception 'Discard class candidates or delete the class through its control API' using errcode = '42501'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.recording_id is not null then raise exception 'Class candidates are worker-owned' using errcode = '42501'; end if;
  elsif old.recording_id is not null or new.recording_id is not null then
    if old.status <> 'pending' or new.status not in ('pending','discarded')
      or (to_jsonb(new) - array['front','back','reading','example_sentence','status','user_edited'])
         is distinct from (to_jsonb(old) - array['front','back','reading','example_sentence','status','user_edited']) then
      raise exception 'Class approval requires the atomic approval function' using errcode = '42501';
    end if;
    new.user_edited = true;
  end if;
  return new;
end $$;
create trigger class_candidate_write_guard before insert or update or delete on candidate_cards
  for each row execute function guard_class_candidate_write();
create policy class_candidate_read on candidate_cards for select to authenticated
  using (recording_id is not null and user_id = auth.uid());
create policy class_candidate_edit on candidate_cards for update to authenticated
  using (recording_id is not null and user_id = auth.uid())
  with check (recording_id is not null and user_id = auth.uid());

create function guard_class_tombstone() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.deleted_at is not null and
    (new.deleted_at is distinct from old.deleted_at or new.state not in ('deleting','deleted')) then
    raise exception 'Deleted classes cannot be resurrected' using errcode = '55000';
  end if;
  if new.processing_generation < old.processing_generation then
    raise exception 'Processing generation cannot decrease' using errcode = '55000';
  end if;
  if new.processing_generation > old.processing_generation then new.derived_stale = true; end if;
  if new.current_note_revision_id is not null and not exists
    (select 1 from class_note_revisions n where n.id = new.current_note_revision_id
      and n.transcript_id = new.current_transcript_id and n.processing_generation = new.processing_generation) then
    new.derived_stale = true;
  end if;
  if new.current_transcript_id is distinct from old.current_transcript_id and new.current_transcript_id is not null
    and (new.deleted_at is not null or not exists (select 1 from class_transcripts t
      where t.id = new.current_transcript_id and t.processing_generation = new.processing_generation)) then
    raise exception 'Cannot publish a deleted or superseded transcript' using errcode = '55000';
  end if;
  if new.current_note_revision_id is distinct from old.current_note_revision_id and new.current_note_revision_id is not null
    and (new.deleted_at is not null or not exists (select 1 from class_note_revisions n
      where n.id = new.current_note_revision_id and n.processing_generation = new.processing_generation
        and n.transcript_id = new.current_transcript_id)) then
    raise exception 'Cannot publish deleted or superseded notes' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger class_tombstone_guard before update on class_recordings for each row execute function guard_class_tombstone();
create function guard_class_output() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare parent class_recordings; generation bigint;
begin
  if new.recording_id is null then return new; end if;
  select * into parent from class_recordings where id = new.recording_id for share;
  if not found or parent.deleted_at is not null then
    raise exception 'Class no longer accepts processing output' using errcode = '55000';
  end if;
  if tg_table_name in ('class_transcripts','class_note_revisions') then
    if new.processing_generation <> parent.processing_generation then
      raise exception 'Superseded processing output' using errcode = '55000';
    end if;
    if tg_table_name = 'class_note_revisions' then
      select processing_generation into generation from class_transcripts where id = new.transcript_id;
      if generation is distinct from new.processing_generation then raise exception 'Transcript generation mismatch'; end if;
    end if;
  end if;
  if tg_table_name in ('class_transcript_segments','class_learning_item_evidence') then
    select processing_generation into generation from class_transcripts where id = new.transcript_id;
    if generation is distinct from parent.processing_generation then raise exception 'Superseded transcript output' using errcode = '55000'; end if;
  elsif tg_table_name = 'class_learning_items' then
    select processing_generation into generation from class_note_revisions where id = new.note_revision_id;
    if generation is distinct from parent.processing_generation then raise exception 'Superseded extraction output' using errcode = '55000'; end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['class_recording_chunks','class_transcripts','class_transcript_segments','class_note_revisions',
    'class_learning_items','class_learning_item_evidence','batches','card_class_evidence'] loop
    execute format('create trigger class_output_guard before insert or update on %I for each row execute function guard_class_output()', t);
  end loop;
end $$;
create function immutable_class_segment() returns trigger language plpgsql as $$
begin
  if new is distinct from old then raise exception 'Transcript edits require a new revision' using errcode = '55000'; end if;
  return new;
end $$;
create trigger class_segment_immutable before update on class_transcript_segments
  for each row execute function immutable_class_segment();
create function guard_class_membership() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare recording_uuid uuid; parent class_recordings;
begin
  select recording_id into recording_uuid from batches where id = new.batch_id;
  if recording_uuid is null then return new; end if;
  select * into parent from class_recordings where id = recording_uuid for share;
  if not found or parent.deleted_at is not null then raise exception 'Deleted class cannot acquire membership' using errcode = '55000'; end if;
  return new;
end $$;
create trigger class_membership_guard before insert or update on batch_cards
  for each row execute function guard_class_membership();

create function approve_class_candidate(p_candidate_id uuid, p_patch jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid(); candidate candidate_cards; recording class_recordings;
  v_card_id uuid; v_batch_id uuid; created boolean := false; instant timestamptz := clock_timestamp();
begin
  if actor is null then raise exception 'User authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists
    (select 1 from jsonb_object_keys(p_patch) k where k not in ('front','back','reading','exampleSentence')) then
    raise exception 'Invalid candidate edit' using errcode = '22023';
  end if;
  select * into candidate from candidate_cards where id = p_candidate_id and user_id = actor and recording_id is not null;
  if not found then raise exception 'Class candidate not found' using errcode = '42501'; end if;
  -- Deletion/publishing controls must take this same parent lock before changing
  -- the generation or tombstone. This serializes approval with cancellation.
  select * into recording from class_recordings where id = candidate.recording_id and user_id = actor for update;
  if not found or recording.state <> 'ready' or recording.deleted_at is not null or recording.derived_stale then
    raise exception 'Class is not available for approval' using errcode = '55000';
  end if;
  select * into candidate from candidate_cards where id = p_candidate_id and user_id = actor for update;
  if candidate.status = 'discarded' then raise exception 'Candidate was discarded' using errcode = '55000'; end if;
  if not exists (select 1 from class_learning_items i where i.id = candidate.learning_item_id
    and i.note_revision_id = recording.current_note_revision_id and i.kind = candidate.kind)
    or not exists (select 1 from class_learning_item_evidence e where e.learning_item_id = candidate.learning_item_id) then
    raise exception 'Candidate requires current validated transcript evidence' using errcode = '23514';
  end if;
  if candidate.status = 'approved' and candidate.approved_card_id is not null then
    select id into v_batch_id from batches where recording_id = recording.id;
    return jsonb_build_object('cardId', candidate.approved_card_id, 'created', false, 'batchId', v_batch_id);
  end if;
  candidate.front := case when p_patch ? 'front' then p_patch->>'front' else candidate.front end;
  candidate.back := case when p_patch ? 'back' then p_patch->>'back' else candidate.back end;
  candidate.reading := case when p_patch ? 'reading' then p_patch->>'reading' else candidate.reading end;
  candidate.example_sentence := case when p_patch ? 'exampleSentence' then p_patch->>'exampleSentence' else candidate.example_sentence end;
  if coalesce(length(btrim(candidate.front)), 0) = 0 or coalesce(length(btrim(candidate.back)), 0) = 0 then
    raise exception 'Card front and back are required' using errcode = '22023';
  end if;
  insert into cards(user_id, source_id, language, kind, front, back, reading, example_sentence)
    values(actor, recording.source_id, recording.target_language, candidate.kind, candidate.front, candidate.back, candidate.reading, candidate.example_sentence)
    on conflict (user_id, language, kind, lower(btrim(front))) do nothing returning id into v_card_id;
  created := found;
  if not created then
    select id into v_card_id from cards where user_id = actor and language = recording.target_language
      and kind = candidate.kind and lower(btrim(front)) = lower(btrim(candidate.front));
    if v_card_id is null then raise exception 'Card changed concurrently; retry approval' using errcode = '40001'; end if;
  end if;
  insert into card_state(card_id, user_id, due_at, fsrs)
    values(v_card_id, actor, instant, jsonb_build_object('due', instant, 'stability', 0, 'difficulty', 0,
      'elapsed_days', 0, 'scheduled_days', 0, 'reps', 0, 'lapses', 0, 'state', 0, 'learning_steps', 0))
    on conflict (card_id) do nothing;
  insert into batches(user_id, source_id, recording_id, label, language)
    values(actor, recording.source_id, recording.id, recording.label, recording.target_language)
    on conflict (recording_id) do nothing;
  select id into v_batch_id from batches where recording_id = recording.id;
  insert into batch_cards(batch_id, card_id, user_id) values(v_batch_id, v_card_id, actor) on conflict do nothing;
  insert into card_class_evidence(card_id, learning_item_id, recording_id, user_id)
    values(v_card_id, candidate.learning_item_id, recording.id, actor) on conflict do nothing;
  update candidate_cards set status = 'approved', approved_card_id = v_card_id, front = candidate.front,
    back = candidate.back, reading = candidate.reading, example_sentence = candidate.example_sentence,
    user_edited = user_edited or p_patch <> '{}'::jsonb where id = candidate.id;
  return jsonb_build_object('cardId', v_card_id, 'created', created, 'batchId', v_batch_id);
end $$;
revoke all on function approve_class_candidate(uuid, jsonb) from public, anon, service_role;
grant execute on function approve_class_candidate(uuid, jsonb) to authenticated;
revoke all on function validate_class_evidence() from public, anon, authenticated;
revoke all on function guard_class_candidate_write() from public, anon, authenticated;
revoke all on function guard_class_tombstone() from public, anon, authenticated;
revoke all on function guard_class_output() from public, anon, authenticated;
revoke all on function immutable_class_segment() from public, anon, authenticated;
revoke all on function guard_class_membership() from public, anon, authenticated;

commit;
