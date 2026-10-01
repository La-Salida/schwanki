-- Async deck generation queue (mirrors the llm_jobs + claim pattern from 0001/0002).
-- Users enqueue/read/cancel their own pending rows; only the service-role worker
-- (bulk-worker, cron'd) transitions status via claim_bulk_jobs.
create table bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  kinds text[] not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table bulk_jobs enable row level security;
create policy "enqueue own bulk jobs" on bulk_jobs for insert
  with check (auth.uid() = user_id and status = 'pending');
create policy "read own bulk jobs" on bulk_jobs for select
  using (auth.uid() = user_id);
-- cancel: users may delete ONLY their own still-pending rows
create policy "cancel own pending bulk jobs" on bulk_jobs for delete
  using (auth.uid() = user_id and status = 'pending');
create index bulk_jobs_pending_idx on bulk_jobs(status, created_at) where status in ('pending','running');

-- Queue claim with SKIP LOCKED so overlapping worker invocations never double-process.
create or replace function claim_bulk_jobs(batch_size int)
returns setof bulk_jobs language sql as $$
  update bulk_jobs
  set status = 'running', attempts = attempts + 1, updated_at = now()
  where id in (
    select id from bulk_jobs
    where status = 'pending' and run_after <= now() and attempts < 3
    order by created_at
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
-- claim mutates the queue: service role only (0003 pattern for claim_llm_jobs)
revoke execute on function claim_bulk_jobs(int) from public, anon, authenticated;
grant execute on function claim_bulk_jobs(int) to service_role;

-- Drain the queue every minute (generations are slow; the worker self-caps its batch)
select cron.schedule('bulk-worker-cron', '* * * * *', $$select call_edge_function('bulk-worker')$$);
