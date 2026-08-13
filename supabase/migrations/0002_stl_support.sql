-- STL (3D-printed) part support: parts carry a file type, and the file
-- column is no longer DXF-specific.

alter table public.parts
  add column file_type text not null default 'dxf'
  check (file_type in ('dxf', 'stl'));

alter table public.parts rename column dxf_path to file_path;
