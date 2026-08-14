-- Checklist-style subtasks on tasks.

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index task_subtasks_task_idx on public.task_subtasks (task_id, position);

alter table public.task_subtasks enable row level security;
create policy "team full access" on public.task_subtasks
  for all to authenticated using (true) with check (true);
