-- Projects ("folders" in ClickUp terms): season-level groupings of tasks.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 80),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column project_id uuid references public.projects (id) on delete set null;

create index tasks_project_idx on public.tasks (project_id);

alter table public.projects enable row level security;
create policy "team full access" on public.projects
  for all to authenticated using (true) with check (true);

insert into public.projects (name) values ('2026 Season'), ('2026 Offseason');
