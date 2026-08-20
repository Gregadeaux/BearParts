-- Supporting documents on a part version: PDF drawings and CNC G-code.

create table public.version_documents (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.part_versions (id) on delete cascade,
  kind text not null check (kind in ('drawing', 'gcode')),
  file_name text not null check (length(file_name) between 1 and 255),
  path text not null,
  size_bytes bigint not null default 0,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index version_documents_version_idx on public.version_documents (version_id, created_at);

alter table public.version_documents enable row level security;
create policy "team full access" on public.version_documents
  for all to authenticated using (true) with check (true);
