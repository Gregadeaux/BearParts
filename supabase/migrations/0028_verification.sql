-- Part verification: a student with the finished part in hand measures its key
-- dimensions (derived from the DXF analysis / 3D model) and records pass/fail.
--
--   1. thickness_in on parts + part_versions — real stock-thickness field
--   2. parts.model_size_in — cached {x, y, z} bounding box (inches) of a STEP/STL
--   3. part_verifications — immutable check records (no update policy);
--      anyone signed in may insert their own, leads/admins delete
--   4. parts.verification_result / verified_at — latest check, trigger-synced
--      so the board can badge it without a join
--   5. notifications kind 'part_check_failed' (submitter hears about a FAIL)
--
-- Not added to supabase_realtime: the part page refreshes after a check, and
-- the board already sees the denormalized columns through public.parts.

-- ============ 1 + 2. part columns ============

alter table public.parts
  add column thickness_in numeric check (thickness_in > 0),
  add column model_size_in jsonb check (jsonb_typeof(model_size_in) = 'object'),
  add column verification_result text
    check (verification_result in ('pass', 'fail', 'incomplete')),
  add column verified_at timestamptz;

alter table public.part_versions
  add column thickness_in numeric check (thickness_in > 0);

-- ============ 3. verification records ============

create table public.part_verifications (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts (id) on delete cascade,
  verified_by uuid default auth.uid() references public.profiles (id) on delete set null,
  result text not null check (result in ('pass', 'fail', 'incomplete')),
  -- [{ id, kind, label, nominal, tolerance, count?, note?, measured: number|null, pass: boolean|null }]
  dimensions jsonb not null check (jsonb_typeof(dimensions) = 'array'),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index part_verifications_part_idx
  on public.part_verifications (part_id, created_at desc);

alter table public.part_verifications enable row level security;

create policy "team reads" on public.part_verifications
  for select to authenticated using (true);
create policy "team inserts own" on public.part_verifications
  for insert to authenticated with check (verified_by = auth.uid());
-- deliberately no update policy: a recorded measurement never changes
create policy "leads delete" on public.part_verifications
  for delete to authenticated using (public.is_lead_or_admin());

-- ============ 4. latest result on the part ============
-- Recomputed (not just copied) so deleting the newest record falls back to
-- the previous one, or clears the badge when none remain. On a part delete
-- the cascade fires this for rows whose part is already gone — the update
-- simply matches nothing.

create or replace function public.sync_part_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    target := old.part_id;
  else
    target := new.part_id;
  end if;

  update public.parts
     set (verification_result, verified_at) = (
       select v.result, v.created_at
         from public.part_verifications v
        where v.part_id = target
        order by v.created_at desc
        limit 1
     )
   where id = target;
  return null;
end;
$$;

drop trigger if exists part_verifications_sync on public.part_verifications;
create trigger part_verifications_sync
  after insert or delete on public.part_verifications
  for each row execute function public.sync_part_verification();

-- ============ 5. notification kind ============

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'part_assigned', 'task_assigned', 'mention', 'part_update', 'task_update',
    'part_check_failed'
  ));
