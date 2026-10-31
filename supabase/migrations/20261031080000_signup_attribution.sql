-- Where each account came from: the first visit's UTM tags and referrer, plus the
-- optional "How did you hear about Schwanki?" answer from onboarding.
create table public.signup_attribution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  referrer text check (char_length(referrer) <= 500),
  landing_path text check (char_length(landing_path) <= 500),
  first_seen_at timestamptz,
  heard_about text check (heard_about in ('reddit', 'short_video', 'youtube', 'teacher', 'friend', 'search', 'hacker_news', 'other')),
  heard_about_other text check (char_length(heard_about_other) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.signup_attribution enable row level security;

create policy "own attribution: read" on public.signup_attribution
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own attribution: insert" on public.signup_attribution
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own attribution: update" on public.signup_attribution
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Founder-only funnel numbers. The analytics schema is not exposed through the API.
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- One row per signup week. Activated = has cards and logged 10+ reviews within 24 hours of signing up.
create or replace view analytics.weekly_funnel as
with users as (
  select u.id, u.created_at,
    coalesce(a.utm_source, a.heard_about, case when a.referrer is not null then 'referral' end, 'unknown') as channel
  from auth.users u
  left join public.signup_attribution a on a.user_id = u.id
),
per_user as (
  select u.id, u.created_at, u.channel,
    exists (select 1 from public.cards c where c.user_id = u.id) as has_cards,
    (select count(*) from public.review_events r
       where r.user_id = u.id and r.reviewed_at < u.created_at + interval '24 hours') as reviews_day1,
    exists (select 1 from public.review_events r
       where r.user_id = u.id and r.reviewed_at >= u.created_at + interval '7 days'
         and r.reviewed_at < u.created_at + interval '14 days') as active_week2,
    exists (select 1 from public.credit_ledger l
       where l.user_id = u.id and l.stripe_session_id is not null and l.delta > 0) as purchased
  from users u
)
select date_trunc('week', created_at)::date as week, channel,
  count(*) as signups,
  count(*) filter (where has_cards and reviews_day1 >= 10) as activated,
  count(*) filter (where active_week2) as reviewing_week2,
  count(*) filter (where purchased) as purchasers
from per_user
group by 1, 2
order by 1 desc, signups desc;

revoke all on analytics.weekly_funnel from public, anon, authenticated;
