-- Audit trail for library-linked queue parts, captured by trigger so no app
-- code path can forget to log. Version uploads need no audit — part_versions
-- rows are immutable and already timestamped.

create table public.part_events (
  id uuid primary key default gen_random_uuid(),
  -- null once the queue entry is deleted; the event itself survives
  part_id uuid references public.parts (id) on delete set null,
  library_part_id uuid not null references public.library_parts (id) on delete cascade,
  version int,
  event text not null check (
    event in ('queued', 'assigned', 'unassigned', 'started', 'completed', 'rejected', 'requeued', 'removed')
  ),
  detail jsonb,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index part_events_library_part_idx on public.part_events (library_part_id, created_at);

alter table public.part_events enable row level security;

create policy "team reads events" on public.part_events
  for select to authenticated using (true);
-- writes happen only via the trigger (security definer) — no insert policy needed

create or replace function public.log_part_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  src record;
  evt text;
  assignee text;
begin
  select pv.version, pv.library_part_id
    into src
    from public.part_versions pv
    where pv.id = coalesce(new.source_version_id, old.source_version_id);
  if src is null then
    return null; -- standalone queue upload, no library timeline to write to
  end if;

  if tg_op = 'INSERT' then
    evt := 'queued';
  elsif tg_op = 'DELETE' then
    evt := 'removed';
  else
    if new.assigned_to is distinct from old.assigned_to then
      evt := case when new.assigned_to is null then 'unassigned' else 'assigned' end;
    elsif new.status is distinct from old.status then
      evt := case new.status
        when 'in_progress' then 'started'
        when 'done' then 'completed'
        when 'rejected' then 'rejected'
        when 'queued' then 'requeued'
        else 'assigned'
      end;
    else
      return null; -- nothing timeline-worthy changed
    end if;
  end if;

  if tg_op <> 'DELETE' and new.assigned_to is not null then
    select display_name into assignee from public.profiles where id = new.assigned_to;
  end if;

  insert into public.part_events (part_id, library_part_id, version, event, detail, actor_id)
  values (
    case when tg_op = 'DELETE' then null else new.id end,
    src.library_part_id,
    src.version,
    evt,
    jsonb_strip_nulls(jsonb_build_object('assignee', assignee)),
    auth.uid()
  );
  return null;
end;
$$;

create trigger parts_log_event
  after insert or update or delete on public.parts
  for each row execute function public.log_part_event();
