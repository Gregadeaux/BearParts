-- Preview thumbnails on fab-queue parts (board cards).
-- Library-sourced parts share their version's thumb; hand uploads get their own.

alter table public.parts add column thumb_path text;

update public.parts p
set thumb_path = v.thumb_path
from public.part_versions v
where p.source_version_id = v.id
  and v.thumb_path is not null;
