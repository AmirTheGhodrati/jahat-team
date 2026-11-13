alter table public.timeline_tasks add column milestone_id uuid references public.timeline_tasks(id) on delete set null;
alter table public.timeline_tasks add constraint no_self_milestone check (milestone_id is null or milestone_id <> id);
