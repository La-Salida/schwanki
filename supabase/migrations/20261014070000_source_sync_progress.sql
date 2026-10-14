-- Class notes rows show what a sync is doing: fetching the file, reading words
-- from it, or done with how many new words it found. Scheduled syncs report the
-- same way as a pressed Sync, so an open page never looks idle.
alter table sources add column if not exists sync_started_at timestamptz;
alter table llm_jobs add column if not exists words_found int;
alter table llm_jobs add column if not exists finished_at timestamptz;

-- One row per source the caller owns. A sync start older than 5 minutes is a
-- run that died before clearing it, so it no longer counts as syncing.
create or replace function source_sync_progress()
returns table (source_id uuid, syncing boolean, parse_status text, words_found int, parse_finished_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
    coalesce(s.sync_started_at > now() - interval '5 minutes', false),
    j.status, j.words_found, j.finished_at
  from sources s
  left join lateral (
    select status, words_found, finished_at
    from llm_jobs
    where type = 'parse' and payload->>'source_id' = s.id::text
    order by (status in ('pending', 'running')) desc, created_at desc
    limit 1
  ) j on true
  where s.user_id = auth.uid()
$$;
revoke execute on function source_sync_progress() from public, anon;
grant execute on function source_sync_progress() to authenticated;

create index if not exists llm_jobs_parse_source_idx
  on llm_jobs ((payload->>'source_id'), created_at desc) where type = 'parse';
