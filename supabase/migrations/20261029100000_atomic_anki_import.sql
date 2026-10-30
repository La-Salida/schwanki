-- A mobile import can be interrupted between any requests. Cards, schedules and
-- historical events must commit together; retries return the original card ids.
create or replace function public.import_anki_batch(p_source_id uuid, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_language text;
  v_item jsonb;
  v_card uuid;
  v_source uuid;
  v_created boolean;
  v_review jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select language into v_language from public.sources
    where id = p_source_id and user_id = v_user and type = 'anki_deck';
  if not found then raise exception 'Anki source not found' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Import at most 100 cards at a time' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(btrim(v_item->>'front'),'') = '' or coalesce(btrim(v_item->>'back'),'') = '' then
      raise exception 'Every card needs a word and meaning' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item->'state') is distinct from 'object'
      or jsonb_typeof(v_item->'state'->'fsrs') is distinct from 'object' then
      raise exception 'Every imported card needs a valid FSRS schedule' using errcode = '22023';
    end if;
    v_card := null;
    insert into public.cards(user_id,source_id,language,front,back,reading,example_sentence)
      values(v_user,p_source_id,v_language,btrim(v_item->>'front'),btrim(v_item->>'back'),
        nullif(v_item->>'reading',''),nullif(v_item->>'exampleSentence',''))
      on conflict do nothing returning id into v_card;
    v_created := v_card is not null;
    if v_created then
      insert into public.card_state(card_id,user_id,due_at,stability,difficulty,reps,lapses,fsrs,last_reviewed_at)
        values(v_card,v_user,(v_item->'state'->>'dueAt')::timestamptz,
          (v_item->'state'->>'stability')::real,(v_item->'state'->>'difficulty')::real,
          (v_item->'state'->>'reps')::integer,(v_item->'state'->>'lapses')::integer,
          v_item->'state'->'fsrs',(v_item->'state'->>'lastReviewedAt')::timestamptz);
      for v_review in select value from jsonb_array_elements(coalesce(v_item->'reviews','[]'::jsonb)) loop
        insert into public.review_events(card_id,user_id,reviewed_at,rating,fsrs_state_before)
          values(v_card,v_user,(v_review->>'reviewedAt')::timestamptz,v_review->>'rating',v_review->'fsrsStateBefore');
      end loop;
      v_source := p_source_id;
    else
      select id, source_id into v_card,v_source from public.cards
        where user_id = v_user and language = v_language and kind = 'vocabulary'
          and lower(btrim(front)) = lower(btrim(v_item->>'front'));
      if not found then raise exception 'Card changed during import; retry' using errcode = '40001'; end if;
      -- Never reset an existing schedule or duplicate its history on retry.
    end if;
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id',v_card,'created',v_created,'ownsMedia',coalesce(v_source = p_source_id,false)));
  end loop;
  return v_result;
end;
$$;
revoke all on function public.import_anki_batch(uuid,jsonb) from public, anon;
grant execute on function public.import_anki_batch(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
