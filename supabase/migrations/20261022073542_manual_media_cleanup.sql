-- Keep failed object deletions retryable after transactional media-row changes.
create table public.card_media_cleanup (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null check (split_part(storage_path, '/', 1) = user_id::text),
  created_at timestamptz not null default now(),
  primary key (user_id, storage_path)
);
alter table public.card_media_cleanup enable row level security;
create policy "read own pending media cleanup" on public.card_media_cleanup for select to authenticated using (auth.uid() = user_id);
create policy "queue own media cleanup" on public.card_media_cleanup for insert to authenticated
  with check (auth.uid() = user_id and (storage.foldername(storage_path))[1] = auth.uid()::text);
create policy "finish own media cleanup" on public.card_media_cleanup for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.card_media_cleanup to authenticated;

create function public.queue_card_media_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.storage_path is null then return null; end if;
  -- card_media paths are client-writable: never let service cleanup delete a
  -- different account's object through a forged media reference.
  if split_part(old.storage_path, '/', 1) <> old.user_id::text then return null; end if;
  if tg_op = 'UPDATE' then
    if old.storage_path is not distinct from new.storage_path then return null; end if;
  end if;
  -- Auth account deletion cascades through media too; its queue cascades away.
  if exists(select 1 from auth.users where id = old.user_id) then
    insert into public.card_media_cleanup(user_id, storage_path)
      values(old.user_id, old.storage_path) on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function public.queue_card_media_cleanup() from public, anon, authenticated;
create trigger queue_card_media_cleanup after delete or update of storage_path on public.card_media
  for each row execute function public.queue_card_media_cleanup();

create policy "delete own media files" on storage.objects for delete to authenticated
  using (bucket_id = 'card-media' and auth.uid()::text = (storage.foldername(name))[1]);
grant delete on storage.objects to authenticated;
