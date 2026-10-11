-- A retried parse resets an older job to pending. Report any pending or running
-- job ahead of finished ones so the Inbox keeps waiting for the retry.
create or replace function parse_job_status(p_source_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select j.status
  from llm_jobs j
  join sources s on s.id = p_source_id and s.user_id = auth.uid()
  where j.type = 'parse' and j.payload->>'source_id' = p_source_id::text
  order by (j.status in ('pending', 'running')) desc, j.created_at desc
  limit 1
$$;
