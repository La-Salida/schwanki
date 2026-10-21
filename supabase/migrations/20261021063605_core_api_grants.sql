-- Fresh projects no longer inherit table privileges from older Supabase defaults.
-- RLS continues to enforce ownership; a policy alone does not grant table access.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  sources, candidate_cards, cards, card_state, card_media,
  push_subscriptions to authenticated;
-- Ratings can be appended and read, but history cannot be rewritten by clients.
revoke update, delete on review_events from authenticated;
grant select, insert on review_events to authenticated;
grant select on source_snapshots, credit_ledger to authenticated;

-- Edge Functions use the trusted service role for processing and credit grants.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
