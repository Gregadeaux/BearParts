-- Per-user favorite library folders — quick access from the home page.

create table public.folder_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, folder_id)
);

alter table public.folder_favorites enable row level security;

create policy "users manage own favorites" on public.folder_favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
