-- Calendar milestones: fixed-date events the team bases deadlines off of.

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  date date not null,
  description text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index milestones_date_idx on public.milestones (date);

alter table public.milestones enable row level security;
create policy "team full access" on public.milestones
  for all to authenticated using (true) with check (true);

-- live calendar
alter publication supabase_realtime add table public.milestones;
