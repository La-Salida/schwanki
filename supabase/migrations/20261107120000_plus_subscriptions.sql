-- Schwanki Plus: one row per user, kept current by the RevenueCat webhook. A user is Plus
-- while expires_at is in the future; metered AI calls are then free (see _shared/usage.ts).
create table public.plus_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_id text not null,
  expires_at timestamptz not null,
  status text not null,
  environment text not null default 'PRODUCTION',
  event_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.plus_subscriptions enable row level security;
revoke all on public.plus_subscriptions from public, anon, authenticated;
grant all on public.plus_subscriptions to service_role;
create policy "Users read their own Plus status" on public.plus_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.plus_subscriptions to authenticated;

-- Events can arrive out of order; the newest event wins and older ones are ignored.
create function public.apply_revenuecat_subscription(
  p_user_id uuid, p_product_id text, p_expires_at timestamptz, p_status text,
  p_environment text, p_event_at bigint
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_event_at <= 0 or p_product_id = '' or p_status = '' then
    raise exception 'Invalid subscription event';
  end if;
  insert into public.plus_subscriptions(user_id, product_id, expires_at, status, environment, event_at, updated_at)
    values (p_user_id, p_product_id, p_expires_at, p_status, p_environment, p_event_at, now())
  on conflict (user_id) do update
    set product_id = excluded.product_id, expires_at = excluded.expires_at, status = excluded.status,
        environment = excluded.environment, event_at = excluded.event_at, updated_at = now()
    where public.plus_subscriptions.event_at < excluded.event_at;
end;
$$;
revoke all on function public.apply_revenuecat_subscription(uuid,text,timestamptz,text,text,bigint) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_subscription(uuid,text,timestamptz,text,text,bigint) to service_role;
