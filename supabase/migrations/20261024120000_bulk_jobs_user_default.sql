-- Deck generation inserted bulk_jobs rows without user_id, so the
-- "enqueue own bulk jobs" check (auth.uid() = user_id) rejected every row.
-- The app now sends it; the default keeps older clients working too.
alter table bulk_jobs alter column user_id set default auth.uid();
