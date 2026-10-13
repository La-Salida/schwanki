-- Production recorded 0017 a second time under this version when it was applied
-- through the dashboard connector. This file mirrors that row so the deploy
-- integration sees matching histories. Same idempotent body as 0017.
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
