-- Lesson recorder v1: the Chrome extension uploads each recorded part of a lesson,
-- lesson-worker transcribes it, and the transcript goes through the normal parse job
-- into the Inbox. Raw audio is deleted once the transcript is saved.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-audio', 'lesson-audio', false, 52428800, array['audio/webm'])
on conflict (id) do nothing;

create policy "read own lesson audio" on storage.objects for select
  using (bucket_id = 'lesson-audio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "write own lesson audio" on storage.objects for insert
  with check (bucket_id = 'lesson-audio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "update own lesson audio" on storage.objects for update
  using (bucket_id = 'lesson-audio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "delete own lesson audio" on storage.objects for delete
  using (bucket_id = 'lesson-audio' and auth.uid()::text = (storage.foldername(name))[1]);

-- One row per uploaded part (sequence 0). The part is also the transcription unit.
alter table class_recording_chunks
  add column if not exists attempts int not null default 0,
  add column if not exists claimed_at timestamptz,
  add column if not exists transcribed_at timestamptz,
  add column if not exists segments jsonb,
  add column if not exists last_error text;

-- Lease parts of lessons waiting for transcription. A claim older than 10 minutes is
-- treated as a crashed worker and taken again; a part gets three tries.
create or replace function claim_lesson_parts(batch_size int)
returns setof class_recording_chunks language sql as $$
  update class_recording_chunks set claimed_at = now(), attempts = attempts + 1
  where (recording_id, channel, part, sequence) in (
    select c.recording_id, c.channel, c.part, c.sequence
    from class_recording_chunks c join class_recordings r on r.id = c.recording_id
    where r.status = 'transcribing' and c.transcribed_at is null and c.attempts < 3
      and (c.claimed_at is null or c.claimed_at < now() - interval '10 minutes')
    order by r.created_at, c.part, c.channel
    limit batch_size
    for update of c skip locked)
  returning *;
$$;
revoke execute on function claim_lesson_parts(int) from public, anon, authenticated;
grant execute on function claim_lesson_parts(int) to service_role;

select cron.schedule('lesson-worker-cron', '*/2 * * * *', $$select call_edge_function('lesson-worker')$$);
