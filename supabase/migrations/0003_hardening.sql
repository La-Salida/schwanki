-- Security hardening (phase-1 review findings)

-- C1: app_settings holds the service-role key (see 0002_cron.sql). Without RLS it is
-- world-readable via the anon key through PostgREST. Enable RLS with NO policies:
-- anon/authenticated get nothing; the service role bypasses RLS, and the cron helper
-- call_edge_function is security definer (owned by postgres), so it keeps working.
alter table app_settings enable row level security;

-- claim_llm_jobs mutates the queue; only the service role (parse-worker) may call it.
-- Functions get EXECUTE on PUBLIC by default, so revoke PUBLIC too — revoking only
-- anon/authenticated is a no-op while the PUBLIC grant stands.
revoke execute on function claim_llm_jobs(int) from public, anon, authenticated;
grant execute on function claim_llm_jobs(int) to service_role;
