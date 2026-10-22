-- Keep manual example edits and invalidation of dependent media in one transaction.
create or replace function public.save_card_example(p_card_id uuid, p_text text, p_translation text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_old_text text;
  v_old_content text;
  v_text text := btrim(coalesce(p_text, ''));
  v_translation text := btrim(coalesce(p_translation, ''));
begin
  if v_user is null then raise exception 'not signed in'; end if;
  perform 1 from public.cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card not found'; end if;
  if length(v_text) > 10000 or length(v_translation) > 10000 then raise exception 'example too long'; end if;

  select content into v_old_content from public.card_media
    where card_id = p_card_id and user_id = v_user and kind = 'sentence';
  begin
    v_old_text := v_old_content::jsonb ->> 'text';
  exception when invalid_text_representation then v_old_text := null;
  end;
  if v_old_text is distinct from nullif(v_text, '') then
    delete from public.card_media where card_id = p_card_id and user_id = v_user and kind in ('image', 'audio');
  end if;
  if v_text = '' then
    delete from public.card_media where card_id = p_card_id and user_id = v_user and kind = 'sentence';
  else
    insert into public.card_media(card_id, user_id, generation_id, kind, content, provider)
    values(p_card_id, v_user, gen_random_uuid(), 'sentence',
      jsonb_build_object('text', v_text, 'translation', v_translation)::text, 'manual')
    on conflict (card_id, kind) do update set content = excluded.content, provider = 'manual',
      generation_id = excluded.generation_id, prompt_used = null, storage_path = null;
  end if;
end;
$$;
revoke all on function public.save_card_example(uuid, text, text) from public, anon;
grant execute on function public.save_card_example(uuid, text, text) to authenticated;
