-- user_google_tokens has update/insert policies but no select policy, so a
-- client UPDATE ... WHERE user_id = ... matches zero rows (RLS hides them) and
-- succeeds silently. The first token was saved; every later sign-in was dropped,
-- leaving an expired token behind (invalid_grant). Save through a definer
-- function instead, still scoped to the caller and still write-only.
create or replace function store_google_refresh_token(token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into user_google_tokens (user_id, refresh_token, updated_at)
  values (auth.uid(), token, now())
  on conflict (user_id) do update
    set refresh_token = excluded.refresh_token, updated_at = excluded.updated_at;
  -- A fresh grant un-parks Google sources a dead token marked revoked.
  update sources set status = 'active', error_detail = null
  where user_id = auth.uid() and status = 'revoked';
end;
$$;

revoke all on function store_google_refresh_token(text) from public, anon;
grant execute on function store_google_refresh_token(text) to authenticated;
