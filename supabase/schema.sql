-- Run in a new, dedicated Supabase project after reviewing the setup instructions.
-- Invite users with confirmed email addresses through Supabase Auth separately.
create table public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member'))
);
revoke all on public.team_members from anon, authenticated;
alter table public.team_members enable row level security;

create function public.is_team_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()));
$$;
create function public.is_team_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_team_member() from public, anon;
revoke all on function public.is_team_admin() from public, anon;
grant execute on function public.is_team_member(), public.is_team_admin() to authenticated;

create table public.idea_matrix (
  id boolean primary key default true check (id),
  content jsonb not null default '{"criteria":[],"ideas":[]}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.idea_matrix enable row level security;
create policy matrix_read on public.idea_matrix for select to authenticated using ((select public.is_team_member()));
-- Writes go through an optimistic concurrency function, not unrestricted table writes.
grant select on public.idea_matrix to authenticated;
insert into public.idea_matrix(id) values (true);
create function public.save_idea_matrix(p_content jsonb, p_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_revision bigint;
begin
  if not public.is_team_member() then raise exception 'access denied' using errcode='42501'; end if;
  if jsonb_typeof(p_content) <> 'object' or jsonb_typeof(p_content->'ideas') <> 'array' or jsonb_typeof(p_content->'criteria') <> 'array' or pg_column_size(p_content) > 1048576 then
    raise exception 'invalid matrix';
  end if;
  update public.idea_matrix set content=p_content, revision=revision+1, updated_at=now()
    where id=true and revision=p_revision returning revision into new_revision;
  if new_revision is null then raise exception 'revision conflict' using errcode='40001'; end if;
  return new_revision;
end $$;
revoke all on function public.save_idea_matrix(jsonb,bigint) from public, anon;
grant execute on function public.save_idea_matrix(jsonb,bigint) to authenticated;

create table public.timeline_settings (id boolean primary key default true check(id), start_date date, title text not null default 'تایم‌لاین جهت');
insert into public.timeline_settings(id) values(true);
alter table public.timeline_settings enable row level security;
grant select, update on public.timeline_settings to authenticated;
create policy timeline_read on public.timeline_settings for select to authenticated using ((select public.is_team_member()));
create policy timeline_update on public.timeline_settings for update to authenticated using ((select public.is_team_admin())) with check ((select public.is_team_admin()));
create table public.timeline_tasks (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 300),
 description text not null default '' check (length(description) <= 5000),
 start_date date not null,
 due_date date not null check(due_date >= start_date),
 assignee uuid references public.team_members(user_id),
 status text not null default 'todo' check(status in ('todo','doing','done')),
 milestone boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.timeline_tasks enable row level security;
grant select, insert, update, delete on public.timeline_tasks to authenticated;
create policy tasks_read on public.timeline_tasks for select to authenticated using ((select public.is_team_member()));
create policy tasks_insert on public.timeline_tasks for insert to authenticated with check ((select public.is_team_admin()));
create policy tasks_update on public.timeline_tasks for update to authenticated using ((select public.is_team_admin())) with check ((select public.is_team_admin()));
create policy tasks_delete on public.timeline_tasks for delete to authenticated using ((select public.is_team_admin()));

create function public.team_directory() returns table (user_id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.role from public.team_members m
  join auth.users u on u.id=m.user_id where public.is_team_member() order by u.email;
$$;
revoke all on function public.team_directory() from public, anon;
grant execute on function public.team_directory() to authenticated;
