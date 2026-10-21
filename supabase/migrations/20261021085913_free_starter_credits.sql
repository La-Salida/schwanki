-- Starter credits are an additive, once-per-account grant in the existing ledger.
alter table public.credit_ledger add column if not exists grant_key text;
create unique index if not exists credit_ledger_user_grant_key
  on public.credit_ledger(user_id, grant_key);

-- Auth's restricted database role cannot write to the ledger directly. Keep the
-- trigger routine private, with a fixed search path and no client execute grant.
create schema if not exists private;
create or replace function private.grant_starter_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and not coalesce(new.is_anonymous, false) then
    insert into public.credit_ledger(user_id, delta, reason, grant_key)
    select new.id, 10, '10 free starter credits', 'starter'
    where not exists (
      select 1 from public.credit_ledger
      where user_id = new.id and stripe_session_id is not null and delta > 0
    )
    on conflict (user_id, grant_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.grant_starter_credits() from public, anon, authenticated;

drop trigger if exists grant_starter_credits on auth.users;
create trigger grant_starter_credits
  after insert or update of email_confirmed_at, is_anonymous on auth.users
  for each row execute function private.grant_starter_credits();

-- Include existing verified free accounts without resetting balances, gifting
-- purchasers retroactively, or refilling a previously spent starter grant.
insert into public.credit_ledger(user_id, delta, reason, grant_key)
select u.id, 10, '10 free starter credits', 'starter'
from auth.users u
where u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false)
  and not exists (
    select 1 from public.credit_ledger l
    where l.user_id = u.id and l.stripe_session_id is not null and l.delta > 0
  )
on conflict (user_id, grant_key) do nothing;
