-- Canva Connect: the canva-connect function keeps each user's Canva tokens and the
-- short-lived PKCE state of a sign-in in progress. Service role only: no client policies.
create table canva_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  created_at timestamptz not null default now()
);
alter table canva_oauth_states enable row level security;

create table user_canva_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table user_canva_tokens enable row level security;
