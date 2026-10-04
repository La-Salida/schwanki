-- Sources expansion: PDF file storage, orphan-safe candidate_cards, sync-pdf cron

-- Private bucket for uploaded PDFs; objects live at {user_id}/{source_id}.pdf
insert into storage.buckets (id, name, public) values ('source-files', 'source-files', false);

create policy "read own source files" on storage.objects for select
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "write own source files" on storage.objects for insert
  with check (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "update own source files" on storage.objects for update
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "delete own source files" on storage.objects for delete
  using (bucket_id = 'source-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- "Keep cards" source removal must not cascade-delete Inbox candidates:
-- orphan them instead (cards.source_id already behaves this way).
alter table candidate_cards alter column source_id drop not null;
alter table candidate_cards drop constraint candidate_cards_source_id_fkey;
alter table candidate_cards
  add constraint candidate_cards_source_id_fkey
  foreign key (source_id) references sources(id) on delete set null;

-- PDF re-sync poll every 6 h, offset from the google poll
select cron.schedule('sync-pdf-cron', '41 */6 * * *', $$select call_edge_function('sync-pdf')$$);
