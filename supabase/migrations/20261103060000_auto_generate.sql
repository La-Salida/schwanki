-- Make memory aids automatically for new words in the decks a learner picks.
-- One row per learner. decks holds "teacher|language" keys (teacher lowercased and
-- trimmed, the same grouping as Your decks); "*|zh" means every teacher in Chinese.
-- No row, or no decks, means off.
create table auto_generate_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  decks text[] not null default '{}' check (cardinality(decks) <= 200),
  kinds text[] not null default '{sentence,image,audio}'
    check (cardinality(kinds) between 1 and 3 and kinds <@ array['sentence','image','audio']),
  daily_limit int not null default 25 check (daily_limit between 1 and 500),
  updated_at timestamptz not null default now()
);
alter table auto_generate_settings enable row level security;
create policy "own auto generate settings" on auto_generate_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on auto_generate_settings to authenticated;
grant all on auto_generate_settings to service_role;

-- Jobs queued by the setting rather than a Generate press, so the daily limit counts only these.
alter table bulk_jobs add column auto boolean not null default false;
create index bulk_jobs_auto_user_idx on bulk_jobs(user_id, created_at) where auto;

-- Queue generation when a word joins a picked deck: approving it from the Inbox,
-- a class recording, or any other insert. Anki imports are left out (that's an
-- existing collection, not new class notes) and so are cards with no source.
-- Never touches cards that already exist, so old aids are never regenerated.
create function queue_auto_generation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s auto_generate_settings;
  src record;
  teacher text;
  queued int;
  balance int;
begin
  if new.source_id is null then return new; end if;
  select * into s from auto_generate_settings where user_id = new.user_id;
  if not found or cardinality(s.decks) = 0 then return new; end if;
  select type, label into src from sources where id = new.source_id;
  if not found or src.type = 'anki_deck' then return new; end if;
  teacher := lower(btrim(regexp_replace(src.label, ' · \d{4}-\d{2}-\d{2}$', '')));
  if not (teacher || '|' || new.language = any(s.decks) or '*|' || new.language = any(s.decks)) then
    return new;
  end if;
  select count(*) into queued from bulk_jobs
    where user_id = new.user_id and auto and created_at > now() - interval '24 hours';
  if queued >= s.daily_limit then return new; end if;
  -- Credit guard: a picture or audio on Schwanki AI costs a credit. Without any key
  -- of their own and with nothing left, don't queue work that can only fail.
  if s.kinds && array['image','audio'] and not exists (select 1 from user_api_keys where user_id = new.user_id) then
    select coalesce(sum(delta), 0) into balance from credit_ledger where user_id = new.user_id;
    if balance < 1 then return new; end if;
  end if;
  insert into bulk_jobs(user_id, card_id, kinds, auto) values (new.user_id, new.id, s.kinds, true);
  return new;
end $$;
revoke execute on function queue_auto_generation() from public, anon, authenticated;

create trigger cards_auto_generate after insert on cards
  for each row execute function queue_auto_generation();
