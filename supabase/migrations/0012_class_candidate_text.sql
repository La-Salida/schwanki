-- Shared card editor saves examples as well as word, meaning and pronunciation.
-- Retain the original RPC for existing clients and approval retries.
create function edit_class_candidate_text(
 p_candidate_id uuid, p_front text, p_back text, p_reading text,
 p_example_sentence text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c candidate_cards;
begin
 if length(p_example_sentence)>10000 then raise exception 'invalid card fields';end if;
 -- The existing function locks the candidate and recording, checks ownership,
 -- rejects tombstoned recordings and validates the shared text fields.
 perform edit_class_candidate(p_candidate_id,p_front,p_back,p_reading);
 select * into c from candidate_cards where id=p_candidate_id;
 if c.status<>'pending' then raise exception 'resolved candidate cannot be edited';end if;
 update candidate_cards set example_sentence=p_example_sentence,
 user_edited=user_edited or example_sentence is distinct from p_example_sentence
 where id=c.id;
end;$$;
revoke execute on function edit_class_candidate_text(uuid,text,text,text,text) from public,anon;
grant execute on function edit_class_candidate_text(uuid,text,text,text,text) to authenticated;
