-- STEP CAD models as a fourth part file type (.step/.stp stored as 'step').

alter table public.parts drop constraint parts_file_type_check;
alter table public.parts
  add constraint parts_file_type_check check (file_type in ('dxf', 'stl', 'pdf', 'step'));

alter table public.part_versions drop constraint part_versions_file_type_check;
alter table public.part_versions
  add constraint part_versions_file_type_check check (file_type in ('dxf', 'stl', 'pdf', 'step'));
