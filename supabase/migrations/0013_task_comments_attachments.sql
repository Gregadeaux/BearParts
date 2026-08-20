-- Chat-style comments and file attachments on tasks.

-- ============ comments ============
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

create policy "team reads task comments" on public.task_comments
  for select to authenticated using (true);

create policy "authors write task comments" on public.task_comments
  for insert to authenticated with check (author_id = auth.uid());

create policy "authors or admins delete task comments" on public.task_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- live discussion
alter publication supabase_realtime add table public.task_comments;

-- ============ attachments ============
-- Files live in the existing private bucket under tasks/{task_id}/{random}/{file_name}.
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_name text not null check (length(file_name) between 1 and 255),
  path text not null,
  size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id, created_at);

alter table public.task_attachments enable row level security;
create policy "team full access" on public.task_attachments
  for all to authenticated using (true) with check (true);
