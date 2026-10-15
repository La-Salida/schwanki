-- Schwanki AI credit packs bought through Stripe Checkout: one grant per session.
alter table credit_ledger add column stripe_session_id text unique;
