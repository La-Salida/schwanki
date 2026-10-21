-- Fresh projects no longer inherit table privileges from older Supabase defaults.
-- RLS continues to enforce ownership; a policy alone does not grant table access.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  sources, candidate_cards, cards, card_state, review_events, card_media,
  push_subscriptions to authenticated;
grant select on source_snapshots, credit_ledger to authenticated;

-- Edge Functions use the trusted service role for processing and credit grants.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
