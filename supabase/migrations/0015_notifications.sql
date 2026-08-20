-- In-app notification inbox (assignments, mentions, updates to your stuff).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('part_assigned', 'task_assigned', 'mention', 'part_update', 'task_update')),
  title text not null,
  body text not null,
  url text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- open team model: any teammate's action may notify any other teammate
create policy "team writes notifications" on public.notifications
  for insert to authenticated with check (true);

create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid());

create policy "users delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- live unread badge (RLS scopes events to the recipient)
alter publication supabase_realtime add table public.notifications;
