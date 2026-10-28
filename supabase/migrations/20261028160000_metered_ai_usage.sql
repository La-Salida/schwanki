-- AI calls on Schwanki's own keys are metered in the ledger. A free use inside the
-- daily allowance is a delta-0 row; past it, each use costs credits like any other spend.
alter table public.credit_ledger add column if not exists feature text;
alter table public.credit_ledger add column if not exists usage_key text;
create index if not exists credit_ledger_user_feature_recent
  on public.credit_ledger (user_id, feature, created_at desc) where feature is not null;
