-- Part library: folder tree + versioned part files, linked to the fab queue.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.folders (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);

-- root-level names must be unique too (null parent bypasses the composite unique)
create unique index folders_root_name_idx on public.folders (name) where parent_id is null;

create table public.library_parts (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_parts_folder_idx on public.library_parts (folder_id);

create table public.part_versions (
  id uuid primary key default gen_random_uuid(),
  library_part_id uuid not null references public.library_parts (id) on delete cascade,
  version int not null,
  file_path text not null,
  file_type text not null check (file_type in ('dxf', 'stl')),
  units text not null default 'unknown' check (units in ('in', 'mm', 'unknown')),
  analysis jsonb,
  note text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (library_part_id, version)
);

create index part_versions_part_idx on public.part_versions (library_part_id);

-- queue entries remember which library version they came from
alter table public.parts
  add column source_version_id uuid references public.part_versions (id) on delete set null;

-- keep updated_at fresh when versions land
create trigger library_parts_touch_updated_at
  before update on public.library_parts
  for each row execute function public.touch_updated_at();

-- open shop-floor trust model, same as parts
alter table public.folders enable row level security;
alter table public.library_parts enable row level security;
alter table public.part_versions enable row level security;

create policy "team full access" on public.folders
  for all to authenticated using (true) with check (true);
create policy "team full access" on public.library_parts
  for all to authenticated using (true) with check (true);
create policy "team full access" on public.part_versions
  for all to authenticated using (true) with check (true);

-- starter structure: 2026 / Cyclone / Intake
with y as (
  insert into public.folders (name) values ('2026') returning id
), c as (
  insert into public.folders (name, parent_id) select 'Cyclone', id from y returning id
)
insert into public.folders (name, parent_id) select 'Intake', id from c;
