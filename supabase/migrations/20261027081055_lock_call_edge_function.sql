-- call_edge_function posts to any edge function with the service key. Only pg_cron (postgres) should call it.
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;
alter function public.call_edge_function(text) set search_path = public, pg_temp;
