-- User roles: admin / lead / student.
--
--   student  create, edit, move, complete anything; CANNOT delete/destroy or
--            archive/restore parts. Still allowed (own data or plain edits):
--            delete own comments, own notifications, own push subscriptions,
--            own folder favorites, own Onshape account; replace a task's
--            assignee / tag sets (task_assignees / task_tags stay fully open).
--   lead     everything a student can do + every delete + archive/restore;
--            may delete anyone's comments; cannot change roles.
--   admin    everything, including changing roles.
--
-- Enforcement lives here (RLS + triggers). The app mirrors it with
-- requireLead()/requireAdmin() (src/lib/supabase/guards.ts) and hides
-- controls in the UI, but the database is the real gate.
--
-- Service-role / SQL-editor sessions (auth.uid() is null) bypass the
-- "who may" checks in the triggers but NOT the last-admin check.

-- ============ 1. role values ============

alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'student' where role = 'member';

update public.profiles set role = 'admin'
  where id in (select id from auth.users where lower(email) = 'gregadeaux@gmail.com');

-- Never land enforcement without an admin: abort (rolls back the whole migration).
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception '0027_roles: no admin profile exists (expected gregadeaux@gmail.com); aborting';
  end if;
end;
$$;

alter table public.profiles
  alter column role set default 'student',
  add constraint profiles_role_check check (role in ('admin', 'lead', 'student'));

-- handle_new_user() (0001) inserts only id/display_name/avatar_url, so new
-- signups pick up the 'student' default above.

-- ============ 2. helpers ============
-- security definer: read profiles without RLS (and without recursing into the
-- profiles policies that call these). null / missing profile = no privileges.

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_lead_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'lead') from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Supabase's default privileges grant EXECUTE to anon too; signed-in only.
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_lead_or_admin() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_lead_or_admin() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ============ 3. role-change protection ============
-- Closes the hole where "users update own profile" let anyone set their own
-- role. Fires on every profiles update; no-op unless role actually changes.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- signed-in callers must be admins; service role / SQL editor pass
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;

    -- applies to everyone, service role included. FOR UPDATE locks the other
    -- admin rows so two admins demoting each other concurrently can't both
    -- pass (one waits / deadlocks and is rolled back).
    if old.role = 'admin' then
      perform 1 from public.profiles
        where role = 'admin' and id <> old.id
        for update;
      if not found then
        raise exception 'There must be at least one admin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- own-profile edits (display name, experimental flag) stay open; with check
-- stops re-pointing a row at another id. Role changes are caught by the trigger.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- lets admins set other people's roles (the trigger still runs)
drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============ 4. archive protection ============
-- Archive and restore are both changes to archived_at.

create or replace function public.guard_part_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and auth.uid() is not null
     and not public.is_lead_or_admin() then
    raise exception 'Only leads and admins can archive parts' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists parts_guard_archive on public.parts;
create trigger parts_guard_archive
  before update on public.parts
  for each row execute function public.guard_part_archive();

-- ============ 5. delete lockdown ============
-- Every "team full access" (for all) table is split into open select / insert
-- / update plus a lead-or-admin delete. task_assignees and task_tags keep
-- "team full access": setAssignees/setTags replace those sets by deleting
-- rows, which is an edit, not destruction.
--
-- FK cascades (e.g. deleting a task removes its subtasks/attachments) bypass
-- RLS, so a lead's delete still cleans up child rows.

-- folders (0003)
drop policy if exists "team full access" on public.folders;
create policy "team reads" on public.folders
  for select to authenticated using (true);
create policy "team inserts" on public.folders
  for insert to authenticated with check (true);
create policy "team updates" on public.folders
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.folders
  for delete to authenticated using (public.is_lead_or_admin());

-- library_parts (0003)
drop policy if exists "team full access" on public.library_parts;
create policy "team reads" on public.library_parts
  for select to authenticated using (true);
create policy "team inserts" on public.library_parts
  for insert to authenticated with check (true);
create policy "team updates" on public.library_parts
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.library_parts
  for delete to authenticated using (public.is_lead_or_admin());

-- part_versions (0003)
drop policy if exists "team full access" on public.part_versions;
create policy "team reads" on public.part_versions
  for select to authenticated using (true);
create policy "team inserts" on public.part_versions
  for insert to authenticated with check (true);
create policy "team updates" on public.part_versions
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.part_versions
  for delete to authenticated using (public.is_lead_or_admin());

-- subgroups (0010)
drop policy if exists "team full access" on public.subgroups;
create policy "team reads" on public.subgroups
  for select to authenticated using (true);
create policy "team inserts" on public.subgroups
  for insert to authenticated with check (true);
create policy "team updates" on public.subgroups
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.subgroups
  for delete to authenticated using (public.is_lead_or_admin());

-- tasks (0010)
drop policy if exists "team full access" on public.tasks;
create policy "team reads" on public.tasks
  for select to authenticated using (true);
create policy "team inserts" on public.tasks
  for insert to authenticated with check (true);
create policy "team updates" on public.tasks
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.tasks
  for delete to authenticated using (public.is_lead_or_admin());

-- projects (0011)
drop policy if exists "team full access" on public.projects;
create policy "team reads" on public.projects
  for select to authenticated using (true);
create policy "team inserts" on public.projects
  for insert to authenticated with check (true);
create policy "team updates" on public.projects
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.projects
  for delete to authenticated using (public.is_lead_or_admin());

-- task_subtasks (0012)
drop policy if exists "team full access" on public.task_subtasks;
create policy "team reads" on public.task_subtasks
  for select to authenticated using (true);
create policy "team inserts" on public.task_subtasks
  for insert to authenticated with check (true);
create policy "team updates" on public.task_subtasks
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.task_subtasks
  for delete to authenticated using (public.is_lead_or_admin());

-- task_attachments (0013)
drop policy if exists "team full access" on public.task_attachments;
create policy "team reads" on public.task_attachments
  for select to authenticated using (true);
create policy "team inserts" on public.task_attachments
  for insert to authenticated with check (true);
create policy "team updates" on public.task_attachments
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.task_attachments
  for delete to authenticated using (public.is_lead_or_admin());

-- milestones (0014)
drop policy if exists "team full access" on public.milestones;
create policy "team reads" on public.milestones
  for select to authenticated using (true);
create policy "team inserts" on public.milestones
  for insert to authenticated with check (true);
create policy "team updates" on public.milestones
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.milestones
  for delete to authenticated using (public.is_lead_or_admin());

-- subsystems (0016)
drop policy if exists "team full access" on public.subsystems;
create policy "team reads" on public.subsystems
  for select to authenticated using (true);
create policy "team inserts" on public.subsystems
  for insert to authenticated with check (true);
create policy "team updates" on public.subsystems
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.subsystems
  for delete to authenticated using (public.is_lead_or_admin());

-- bom_items (0016)
drop policy if exists "team full access" on public.bom_items;
create policy "team reads" on public.bom_items
  for select to authenticated using (true);
create policy "team inserts" on public.bom_items
  for insert to authenticated with check (true);
create policy "team updates" on public.bom_items
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.bom_items
  for delete to authenticated using (public.is_lead_or_admin());

-- version_documents (0020)
drop policy if exists "team full access" on public.version_documents;
create policy "team reads" on public.version_documents
  for select to authenticated using (true);
create policy "team inserts" on public.version_documents
  for insert to authenticated with check (true);
create policy "team updates" on public.version_documents
  for update to authenticated using (true) with check (true);
create policy "leads delete" on public.version_documents
  for delete to authenticated using (public.is_lead_or_admin());

-- parts (0001): submitter-or-admin -> lead-or-admin only
drop policy if exists "submitter or admin deletes parts" on public.parts;
create policy "leads delete parts" on public.parts
  for delete to authenticated using (public.is_lead_or_admin());

-- comments: author, or any lead/admin (was author-or-admin)
drop policy if exists "authors or admins delete comments" on public.part_comments;
create policy "authors or leads delete comments" on public.part_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_lead_or_admin());

drop policy if exists "authors or admins delete task comments" on public.task_comments;
create policy "authors or leads delete task comments" on public.task_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_lead_or_admin());

drop policy if exists "authors or admins delete subsystem comments" on public.subsystem_comments;
create policy "authors or leads delete subsystem comments" on public.subsystem_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_lead_or_admin());

-- storage (0001): only leads/admins remove files. Uploads (incl. upsert
-- overwrites) need insert/select/update, never delete, so student uploads are
-- unaffected. A student's remove() silently removes nothing.
drop policy if exists "team deletes dxf files" on storage.objects;
create policy "leads delete dxf files" on storage.objects
  for delete to authenticated using (bucket_id = 'dxf' and public.is_lead_or_admin());
