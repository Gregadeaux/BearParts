-- Subsystems: a library folder promoted to a project workspace —
-- tasks, discussion, fab-queue view, and a BOM.

create table public.subsystems (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- the folder whose subtree defines which library parts belong here
  folder_id uuid not null unique references public.folders (id) on delete cascade,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.subsystems enable row level security;
create policy "team full access" on public.subsystems
  for all to authenticated using (true) with check (true);

-- tag tasks onto a subsystem (they stay in their project's board too)
alter table public.tasks add column subsystem_id uuid references public.subsystems (id) on delete set null;
create index tasks_subsystem_id_idx on public.tasks (subsystem_id);

-- ============ discussion ============
create table public.subsystem_comments (
  id uuid primary key default gen_random_uuid(),
  subsystem_id uuid not null references public.subsystems (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index subsystem_comments_idx on public.subsystem_comments (subsystem_id, created_at);

alter table public.subsystem_comments enable row level security;

create policy "team reads subsystem comments" on public.subsystem_comments
  for select to authenticated using (true);

create policy "authors write subsystem comments" on public.subsystem_comments
  for insert to authenticated with check (author_id = auth.uid());

create policy "authors or admins delete subsystem comments" on public.subsystem_comments
  for delete to authenticated using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

alter publication supabase_realtime add table public.subsystem_comments;

-- ============ BOM ============
create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  subsystem_id uuid not null references public.subsystems (id) on delete cascade,
  vendor text not null check (vendor in ('custom', 'wcp', 'ttb', 'rev', 'ctre', 'andymark', 'vex', 'mcmaster')),
  -- set when vendor = 'custom': one of our library parts
  library_part_id uuid references public.library_parts (id) on delete set null,
  name text not null check (length(name) between 1 and 200),
  sku text,
  url text,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(10, 2),
  -- groundwork for the future order-list / PO flow
  status text not null default 'planned' check (status in ('planned', 'to_order', 'ordered', 'received')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index bom_items_subsystem_idx on public.bom_items (subsystem_id, created_at);

alter table public.bom_items enable row level security;
create policy "team full access" on public.bom_items
  for all to authenticated using (true) with check (true);
