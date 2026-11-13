create or replace function public.save_idea_matrix(p_content jsonb, p_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_revision bigint;
begin
  if not public.is_team_member() then raise exception 'access denied' using errcode='42501'; end if;
  if jsonb_typeof(p_content) is distinct from 'object' or jsonb_typeof(p_content->'ideas') is distinct from 'array' or jsonb_typeof(p_content->'criteria') is distinct from 'array' or pg_column_size(p_content) > 1048576 then
    raise exception 'invalid matrix';
  end if;
  update public.idea_matrix set content=p_content, revision=revision+1, updated_at=now()
    where id=true and revision=p_revision returning revision into new_revision;
  if new_revision is null then raise exception 'revision conflict' using errcode='40001'; end if;
  return new_revision;
end $$;
