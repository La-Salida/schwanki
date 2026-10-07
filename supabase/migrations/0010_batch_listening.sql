-- Batch listening: lesson batches + listening packs (spec 2026-10-04 §2, §4.4)

create table batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references sources(id) on delete set null,
  label text not null,               -- e.g. '2026-09-30' (triage day grouping)
  language text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_id, label) -- get-or-create at triage approval
);
alter table batches enable row level security;
create policy "own batches" on batches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table cards add column batch_id uuid references batches(id) on delete set null;
create index cards_batch_idx on cards(batch_id);

create table listening_packs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  part int not null default 1,       -- overflow batches: part 2, 3, ...
  script jsonb,                      -- { lines: [{speaker, text, translation}], words_used: uuid[] }
  audio_path text,
  voices jsonb,                      -- { a: voiceId, b: voiceId }
  model_used text,
  cost_cents int not null default 0,
  missing_words text[] not null default '{}',  -- fronts that didn't make the cut
  status text not null default 'queued' check (status in ('queued','ready','failed')),
  created_at timestamptz not null default now()
);
alter table listening_packs enable row level security;
create policy "read own packs" on listening_packs for select using (auth.uid() = user_id);
-- writes are service-role only (edge function), except status retry resets:
create policy "retry own failed pack" on listening_packs for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id and status in ('queued','failed'));

create table listening_pack_words (
  pack_id uuid not null references listening_packs(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  made_it bool not null,
  primary key (pack_id, card_id)
);
alter table listening_pack_words enable row level security;
create policy "read own pack words" on listening_pack_words for select
  using (exists (select 1 from listening_packs p where p.id = pack_id and p.user_id = auth.uid()));
-- inserts are service-role only
