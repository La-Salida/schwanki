-- Schwanki Phase 1 schema
create extension if not exists pgcrypto;

-- Sources of vocabulary (§5)
create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('google_sheet','google_doc','pdf_upload','preply_chat','manual')),
  external_ref text not null,          -- doc/sheet URL or file id
  label text not null,
  language text not null,              -- ISO 639-1: 'zh', 'th', ...
  last_synced_at timestamptz,
  content_hash text,
  status text not null default 'active' check (status in ('active','error','revoked')),
  error_detail text,
  created_at timestamptz not null default now()
);
create index sources_user_idx on sources(user_id);

-- Full-text snapshot per successful fetch, for line-diff incremental sync (§6.3)
create table source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  content text not null,
  fetched_at timestamptz not null default now()
);
create index source_snapshots_source_idx on source_snapshots(source_id, fetched_at desc);

-- Triage inbox (§5)
create table candidate_cards (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  front text not null,
  back text not null,
  reading text,
  example_sentence text,
  raw_context text not null,
  status text not null default 'pending' check (status in ('pending','approved','discarded')),
  confidence real not null default 0.5,
  parse_notes text,
  created_at timestamptz not null default now()
);
create index candidate_cards_inbox_idx on candidate_cards(source_id, status, created_at);

-- Approved deck cards (§5)
create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  language text not null,
  front text not null,
  back text not null,
  reading text,
  example_sentence text,
  created_at timestamptz not null default now()
);
create unique index cards_dedup_key on cards(user_id, language, lower(btrim(front)));
create index cards_user_idx on cards(user_id);

-- FSRS scheduling state per card (§5)
create table card_state (
  card_id uuid primary key references cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz not null,
  stability real not null default 0,
  difficulty real not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  fsrs jsonb not null,                 -- serialized ts-fsrs Card, source of truth
  last_reviewed_at timestamptz
);
create index card_state_due_idx on card_state(user_id, due_at);

-- Append-only review log (§5)
create table review_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null,
  rating text not null check (rating in ('again','hard','good','easy')),
  elapsed_ms int,
  fsrs_state_before jsonb not null
);
create index review_events_card_idx on review_events(card_id, reviewed_at);

-- Job queue (§4.2). Phase 1 uses type='parse'; enrich_* types arrive in Phase 2.
create table llm_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('parse','enrich_sentence','enrich_audio','enrich_image','enrich_video','ocr')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_error text
);
create index llm_jobs_pending_idx on llm_jobs(status, run_after) where status in ('pending','running');

-- Web Push subscriptions (§4.2)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,                 -- { p256dh, auth }
  remind_hour int not null default 9 check (remind_hour between 0 and 23),
  tz text not null default 'UTC',
  created_at timestamptz not null default now()
);
create index push_subscriptions_remind_idx on push_subscriptions(remind_hour);

-- Google OAuth refresh tokens captured at sign-in (needed for private docs, §3)
create table user_google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- Row-level security
alter table sources enable row level security;
alter table source_snapshots enable row level security;
alter table candidate_cards enable row level security;
alter table cards enable row level security;
alter table card_state enable row level security;
alter table review_events enable row level security;
alter table llm_jobs enable row level security;
alter table push_subscriptions enable row level security;
alter table user_google_tokens enable row level security;

create policy "own sources" on sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshots" on source_snapshots for select using (
  exists (select 1 from sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "own candidates" on candidate_cards for all using (
  exists (select 1 from sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "own cards" on cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own card_state" on card_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own review_events" on review_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- llm_jobs: no user policy — service role only (edge functions bypass RLS)
create policy "own push subs" on push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- refresh token: write-only-ish; user can upsert own row, only service role selects
create policy "upsert own google token" on user_google_tokens for insert with check (auth.uid() = user_id);
create policy "update own google token" on user_google_tokens for update using (auth.uid() = user_id);

-- Queue claim with SKIP LOCKED so multiple parse-worker invocations don't double-process
create or replace function claim_llm_jobs(batch_size int)
returns setof llm_jobs language sql as $$
  update llm_jobs
  set status = 'running', attempts = attempts + 1
  where id in (
    select id from llm_jobs
    where status = 'pending' and run_after <= now()
    order by created_at
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
