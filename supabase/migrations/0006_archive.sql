-- Soft-archive for queue parts: hidden from the board, restorable with
-- original status intact.

alter table public.parts add column archived_at timestamptz;

create index parts_archived_idx on public.parts (archived_at) where archived_at is not null;
