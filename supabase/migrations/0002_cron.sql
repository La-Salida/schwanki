create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Config rows seeded manually per environment (never commit keys):
--   insert into app_settings values ('functions_base_url', 'http://host.docker.internal:54321/functions/v1');
--   insert into app_settings values ('service_key', '<service_role_jwt>');
create table if not exists app_settings (key text primary key, value text not null);

create or replace function call_edge_function(fn_name text)
returns void language plpgsql security definer as $$
declare
  base text; key text;
begin
  select value into base from app_settings where app_settings.key = 'functions_base_url';
  select value into key from app_settings where app_settings.key = 'service_key';
  if base is null or key is null then
    raise warning 'app_settings missing functions_base_url/service_key; skipping %', fn_name;
    return;
  end if;
  perform net.http_post(
    url := base || '/' || fn_name,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;

-- Scheduled poll every 6 h (§6.1), off-peak minute
select cron.schedule('sync-google-cron', '17 */6 * * *', $$select call_edge_function('sync-google')$$);
-- Drain parse queue every 10 min
select cron.schedule('parse-worker-cron', '*/10 * * * *', $$select call_edge_function('parse-worker')$$);
-- Push reminders hourly (function arrives in Task 17)
select cron.schedule('push-notify-cron', '43 * * * *', $$select call_edge_function('push-notify')$$);
