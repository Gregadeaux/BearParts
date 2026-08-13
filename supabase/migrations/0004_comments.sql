-- Discussion stream on library parts.

create table public.part_comments (
  id uuid primary key default gen_random_uuid(),
  library_part_id uuid not null references public.library_parts (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index part_comments_part_idx on public.part_comments (library_part_id, created_at);

alter table public.part_comments enable row level security;

create policy "team reads comments" on public.part_comments
  for select to authenticated using (true);

create policy "authors write comments" on public.part_comments
  for insert to authenticated with check (author_id = auth.uid());

create policy "authors or admins delete comments" on public.part_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- live discussion
alter publication supabase_realtime add table public.part_comments;
