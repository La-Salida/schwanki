-- A parse-worker run that dies mid-job (timeout, redeploy) left the job 'running'
-- forever, so the class notes never reached the Inbox and nothing said why.
-- Claiming now leases a job for 10 minutes via run_after; an expired lease is
-- claimed again (and still counts as an attempt, so it fails after 3).
create or replace function public.claim_llm_jobs(batch_size integer)
returns setof llm_jobs
language sql
as $$
  update llm_jobs set status = 'running', attempts = attempts + 1, run_after = now() + interval '10 minutes'
  where id in (
    select id from llm_jobs
    where type = 'parse' and status in ('pending', 'running') and run_after <= now()
    order by created_at limit batch_size for update skip locked
  ) returning *;
$$;
