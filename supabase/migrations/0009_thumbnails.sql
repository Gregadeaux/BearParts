-- Preview thumbnails, generated client-side at upload time.

alter table public.part_versions add column thumb_path text;
