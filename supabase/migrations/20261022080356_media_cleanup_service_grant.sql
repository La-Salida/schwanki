-- Explicit grants also cover installations with restrictive default privileges.
grant select, delete on public.card_media_cleanup to service_role;
