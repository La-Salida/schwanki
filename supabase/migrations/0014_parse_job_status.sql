-- Lets the Inbox tell when a source's latest parse finished, without exposing
-- llm_jobs (service-role only) or its payload text to the browser.
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
  order by j.created_at desc
  limit 1
$$;
revoke execute on function parse_job_status(uuid) from public, anon;
grant execute on function parse_job_status(uuid) to authenticated;
