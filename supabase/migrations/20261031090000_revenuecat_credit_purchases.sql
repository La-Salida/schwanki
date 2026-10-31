-- One canonical owner/state per consumable transaction, including out-of-order refunds.
create table public.revenuecat_purchases (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  credits integer not null check (credits > 0),
  credited integer not null default 0,
  event_at bigint not null default 0,
  event_priority integer not null default -1
);
alter table public.revenuecat_purchases enable row level security;
revoke all on public.revenuecat_purchases from public, anon, authenticated;
grant all on public.revenuecat_purchases to service_role;

create function public.apply_revenuecat_purchase(
  p_transaction_id text, p_user_id uuid, p_product_id text, p_credits integer,
  p_event_id text, p_event_at bigint, p_event_type text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  purchase public.revenuecat_purchases%rowtype;
  target_credits integer;
  priority integer;
begin
  if p_event_type not in ('NON_RENEWING_PURCHASE','CANCELLATION','REFUND_REVERSED')
    or p_credits <= 0 or p_event_at <= 0 then
    raise exception 'Invalid purchase event';
  end if;
  -- Inserts racing on the same transaction block here, then lock its committed state.
  insert into public.revenuecat_purchases(transaction_id,user_id,product_id,credits)
    values(p_transaction_id,p_user_id,p_product_id,p_credits) on conflict do nothing;
  select * into strict purchase from public.revenuecat_purchases
    where transaction_id=p_transaction_id for update;
  if purchase.user_id <> p_user_id or purchase.product_id <> p_product_id then
    raise exception 'Purchase owner or product mismatch';
  end if;
  priority := case p_event_type when 'CANCELLATION' then 2 when 'REFUND_REVERSED' then 1 else 0 end;
  -- A refund can arrive before its purchase, without the purchase's quantity.
  -- Preserve that quantity even when the purchase event is older than the refund.
  if p_event_type = 'NON_RENEWING_PURCHASE' and purchase.credits <> p_credits then
    purchase.credits := p_credits;
    update public.revenuecat_purchases set credits=p_credits where transaction_id=p_transaction_id;
  end if;
  if (p_event_at,priority) <= (purchase.event_at,purchase.event_priority) then
    -- A reversal can also arrive before the original quantity-bearing purchase.
    -- Correct its amount while preserving the newer refund/reversal state.
    if p_event_type='NON_RENEWING_PURCHASE' and purchase.credited > 0
      and purchase.credited <> purchase.credits then
      insert into public.credit_ledger(user_id,delta,reason,grant_key)
        values(purchase.user_id,purchase.credits-purchase.credited,'App Store credit quantity adjustment',
          'revenuecat:' || p_transaction_id || ':' || p_event_id);
      update public.revenuecat_purchases set credited=purchase.credits where transaction_id=p_transaction_id;
    end if;
    return;
  end if;
  target_credits := case when p_event_type='CANCELLATION' then 0 else purchase.credits end;
  if target_credits <> purchase.credited then
    insert into public.credit_ledger(user_id,delta,reason,grant_key)
      values(purchase.user_id,target_credits-purchase.credited,
        case when target_credits=0 then 'App Store credit refund' else 'App Store credit purchase' end,
        'revenuecat:' || p_transaction_id || ':' || p_event_id);
  end if;
  update public.revenuecat_purchases set credits=purchase.credits,credited=target_credits,
    event_at=p_event_at,event_priority=priority where transaction_id=p_transaction_id;
end;
$$;
revoke all on function public.apply_revenuecat_purchase(text,uuid,text,integer,text,bigint,text) from public,anon,authenticated;
grant execute on function public.apply_revenuecat_purchase(text,uuid,text,integer,text,bigint,text) to service_role;
