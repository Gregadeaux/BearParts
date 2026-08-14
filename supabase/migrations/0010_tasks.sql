-- High-level task tracking (ClickUp-style), separate from the parts queue.

create table public.subgroups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6366f1', -- hex, drives task color-coding
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done')),
  subgroup_id uuid references public.subgroups (id) on delete set null,
  start_date date,
  due_date date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_idx on public.tasks (status);
create index tasks_due_idx on public.tasks (due_date);
create index tasks_subgroup_idx on public.tasks (subgroup_id);

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag text not null check (length(tag) between 1 and 40),
  primary key (task_id, tag)
);

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- open team trust model, consistent with the rest of the app
alter table public.subgroups enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_tags enable row level security;

create policy "team full access" on public.subgroups
  for all to authenticated using (true) with check (true);
create policy "team full access" on public.tasks
  for all to authenticated using (true) with check (true);
create policy "team full access" on public.task_assignees
  for all to authenticated using (true) with check (true);
create policy "team full access" on public.task_tags
  for all to authenticated using (true) with check (true);

-- live boards
alter publication supabase_realtime add table public.tasks;

-- starter subgroups (editable later)
insert into public.subgroups (name, color) values
  ('Mechanical', '#f59e0b'),
  ('Electrical', '#eab308'),
  ('Programming', '#3b82f6'),
  ('Design', '#8b5cf6'),
  ('Business', '#10b981');
