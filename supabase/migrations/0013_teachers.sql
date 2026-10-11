-- One row per teacher name a learner uses in source labels, holding the
-- teacher's Preply profile and photo so class notes and decks can show a face.
create table teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  name_key text generated always as (lower(btrim(name))) stored,
  preply_url text check (preply_url is null or preply_url ~ '^https://([a-z0-9-]+\.)?preply\.com/'),
  photo_url text check (photo_url is null or photo_url ~ '^https://avatars\.preply\.com/'),
  updated_at timestamptz not null default now(),
  unique (user_id, name_key)
);
alter table teachers enable row level security;
create policy "own teachers" on teachers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
