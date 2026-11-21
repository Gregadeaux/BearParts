---
name: supabase-workflow
description: How this repo talks to Supabase — project ref, migrations, auth, storage. Use for any schema change or Supabase config work.
---

# Supabase workflow

- Project: **BearParts**, ref `lrufhxysqcrmthqzyqwq` (ca-central-1), already linked
  via `npx supabase link`. Keys live in `.env.local` (never commit).
- **Schema changes = new numbered migration** in `supabase/migrations/`, applied with
  `npx supabase db push`. Never edit an applied migration; never change schema via
  dashboard.
- **RLS philosophy:** open shop-floor trust for read / create / edit — the whole
  authenticated team can select, insert, and update nearly everything (inserts set
  `submitted_by` / `author_id` = `auth.uid()` where those columns exist). **Destruction
  is role-gated** (`profiles.role`: `admin` / `lead` / `student`, migration 0027):
  every delete policy — including `storage.objects` in the `dxf` bucket — is
  `using (public.is_lead_or_admin())`. Exceptions: comment authors delete their own
  comments (leads delete anyone's); users delete their own notifications, push subs,
  folder favorites, Onshape account; `task_assignees` / `task_tags` stay fully open
  (replacing those sets is an edit). Archiving/restoring parts is lead-only via the
  `parts_guard_archive` trigger. Role changes are admin-only and the last admin can't
  be demoted (`profiles_guard_role` trigger; service role bypasses the admin check,
  not the last-admin check). SQL helpers: `current_user_role()`, `is_lead_or_admin()`,
  `is_admin()` (security definer). New tables: split select/insert/update open +
  lead-only delete — never `for all`. Profiles auto-create as `student` via the
  `on_auth_user_created` trigger. Verify with `node scripts/test-roles.mjs`.
- **Storage:** all files live in the private `dxf` bucket (historical name).
  Quick queue uploads: `parts/<partId>.<ext>`. Library versions:
  `library/<libraryPartId>/v<n>.<ext>`. Task attachments (any format):
  `tasks/<taskId>/<uuid>/<safeName>`. Access via signed URLs only.
- **Library:** `folders` (tree, delete only when empty) → `library_parts` →
  `part_versions` (unique per part, latest = max version). Queue `parts` rows
  created from the library set `source_version_id` and SHARE the version's
  storage file — deletePartAction must never delete storage for those.
- **Subsystems:** a library folder promoted to a project workspace
  (`subsystems`: unique folder_id + project_id). Part membership is DERIVED
  from the folder subtree (`subtreeFolderIds`) — never stored per part.
  `tasks.subsystem_id` tags tasks (on delete set null); `subsystem_comments`
  mirrors the other comment tables; `bom_items` holds the BOM (vendor enum:
  custom/wcp/ttb/rev/ctre/andymark/vex/mcmaster; status planned→to_order→
  ordered→received is groundwork for the future order-list/PO flow).
- **Auth:** Supabase Auth with Google OAuth. Redirect flows go through
  `/auth/callback` which exchanges the code and redirects home.
- **Realtime:** enabled on `public.parts`, `public.part_comments`,
  `public.tasks`, `public.task_comments`, `public.milestones`,
  `public.notifications` (RLS scopes notification events to the recipient, so
  no channel filter is needed there), and `public.subsystem_comments`
  (`part_verifications` is deliberately not published). ALWAYS
  subscribe through `useLiveTable` (src/lib/use-live-table.ts) — postgres_changes
  on RLS'd tables silently delivers nothing unless `realtime.setAuth(jwt)` runs
  BEFORE `.subscribe()`; the hook handles that plus token refresh, focus refetch,
  and a slow poll fallback. Never hand-roll a channel subscription.
  Verify delivery end-to-end with `node scripts/test-realtime.mjs`.
- **Notifying teammates:** always go through `notifyUsers()`
  (src/services/notify.service.ts) — it writes `notifications` inbox rows and
  sends the matching web push in one call, and always excludes the actor.
  Pass `push: false` for low-signal events (routine status changes); never
  call `sendPush` directly from actions.
- `parts.analysis` stores the `DxfAnalysis` JSON computed at upload; treat it as a
  cache — the client can always recompute from the DXF.
- **Verification** (0028): `part_verifications` rows are **immutable** — select
  open, insert only as yourself (`verified_by = auth.uid()`), **no update
  policy**, delete lead-only (`deleteVerificationAction` → `requireLead()`).
  Per-dimension results live in the `dimensions` jsonb array. The
  `part_verifications_sync` trigger recomputes `parts.verification_result` /
  `verified_at` from the newest remaining row on insert/delete (board badge, no
  join). A FAIL notifies the submitter with kind `part_check_failed`.
  `thickness_in` (numeric inches) exists on both `parts` and `part_versions`
  and is copied version → queue part; `parts.model_size_in` caches a STEP/STL
  bounding box. Smoke test: `node scripts/test-verifications.mjs`.
