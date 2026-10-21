-- Keep event deduplication and its schedule mutation in the same transaction.
-- Invoker security retains the existing ownership policies on every table.
create or replace function public.save_review(p_state jsonb, p_event jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_card uuid := (p_event->>'cardId')::uuid;
  v_at timestamptz := (p_event->>'reviewedAt')::timestamptz;
  v_inserted integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if v_card is null or (p_state->>'cardId')::uuid is distinct from v_card then
    raise exception 'review card mismatch' using errcode = '22023';
  end if;

  -- Serialize reviews from separate devices before deduplicating or changing state.
  perform 1 from public.cards where id = v_card and user_id = v_user for update;
  if not found then
    raise exception 'violates foreign key constraint "card_state_card_id_fkey"'
      using errcode = '23503';
  end if;

  insert into public.review_events(id, card_id, user_id, reviewed_at, rating, elapsed_ms, fsrs_state_before)
  values ((p_event->>'id')::uuid, v_card, v_user, v_at, p_event->>'rating',
    (p_event->>'elapsedMs')::integer, p_event->'fsrsStateBefore')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  insert into public.card_state as stored
    (card_id, user_id, due_at, stability, difficulty, reps, lapses, fsrs, last_reviewed_at)
  values (v_card, v_user, (p_state->>'dueAt')::timestamptz,
    (p_state->>'stability')::real, (p_state->>'difficulty')::real,
    (p_state->>'reps')::integer, (p_state->>'lapses')::integer, p_state->'fsrs', v_at)
  on conflict (card_id) do update set
    due_at = excluded.due_at, stability = excluded.stability,
    difficulty = excluded.difficulty, reps = excluded.reps, lapses = excluded.lapses,
    fsrs = excluded.fsrs, last_reviewed_at = excluded.last_reviewed_at
  where stored.last_reviewed_at is null or excluded.last_reviewed_at >= stored.last_reviewed_at;
  return true;
end;
$$;

revoke all on function public.save_review(jsonb,jsonb) from public, anon;
grant execute on function public.save_review(jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
