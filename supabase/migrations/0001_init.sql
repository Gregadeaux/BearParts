-- BearParts initial schema
-- Run via Supabase SQL editor or `supabase db push`

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by team" on public.profiles
  for select to authenticated using (true);

create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());

-- auto-create profile on signup (pulls name/avatar from Google OAuth metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ parts ============
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  material text,
  quantity int not null default 1 check (quantity > 0),
  status text not null default 'queued'
    check (status in ('queued', 'assigned', 'in_progress', 'done', 'rejected')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  submitted_by uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id),
  dxf_path text not null,
  units text not null default 'unknown' check (units in ('in', 'mm', 'unknown')),
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index parts_status_idx on public.parts (status);
create index parts_assigned_to_idx on public.parts (assigned_to);

alter table public.parts enable row level security;

-- whole team can see and manage the queue
create policy "parts viewable by team" on public.parts
  for select to authenticated using (true);

create policy "team members submit parts" on public.parts
  for insert to authenticated with check (submitted_by = auth.uid());

create policy "team members update parts" on public.parts
  for update to authenticated using (true);

create policy "submitter or admin deletes parts" on public.parts
  for delete to authenticated using (
    submitted_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger parts_touch_updated_at
  before update on public.parts
  for each row execute function public.touch_updated_at();

-- live queue updates
alter publication supabase_realtime add table public.parts;

-- ============ push subscriptions ============
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own subscriptions" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ storage ============
insert into storage.buckets (id, name, public)
values ('dxf', 'dxf', false);

create policy "team reads dxf files" on storage.objects
  for select to authenticated using (bucket_id = 'dxf');

create policy "team uploads dxf files" on storage.objects
  for insert to authenticated with check (bucket_id = 'dxf');

create policy "team deletes dxf files" on storage.objects
  for delete to authenticated using (bucket_id = 'dxf');
