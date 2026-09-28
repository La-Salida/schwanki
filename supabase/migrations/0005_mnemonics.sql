-- Mnemonic generation: BYOK keys, card media artifacts, credit ledger (§spec 3)

create table user_api_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic','openai','fal','together','higgsfield')),
  api_key text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table user_api_keys enable row level security;
create policy "insert own api key" on user_api_keys for insert with check (auth.uid() = user_id);
create policy "update own api key" on user_api_keys for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own api key" on user_api_keys for delete using (auth.uid() = user_id);
-- deliberately NO select policy: keys are write-only (same pattern as user_google_tokens)

-- Provider-status view: lets the Settings UI show "key saved ✓" without exposing secrets.
-- Views are security-definer by default (owner postgres bypasses RLS); the filter is baked in.
create view my_api_key_providers as
  select provider, updated_at from user_api_keys where user_id = auth.uid();
grant select on my_api_key_providers to authenticated;

create table card_media (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid not null,
  kind text not null check (kind in ('sentence','image','audio')),
  content text,
  storage_path text,
  prompt_used text,
  provider text,
  created_at timestamptz not null default now(),
  unique (card_id, kind) -- regenerate replaces, never accumulates
);
alter table card_media enable row level security;
create policy "own card_media" on card_media for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  generation_id uuid,
  created_at timestamptz not null default now()
);
alter table credit_ledger enable row level security;
create policy "read own ledger" on credit_ledger for select using (auth.uid() = user_id);
-- no user write policies: debits and grants are service-role only (edge function / manual SQL)

insert into storage.buckets (id, name, public) values ('card-media', 'card-media', false);
create policy "read own media files" on storage.objects for select
  using (bucket_id = 'card-media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "write own media files" on storage.objects for insert
  with check (bucket_id = 'card-media' and auth.uid()::text = (storage.foldername(name))[1]);
