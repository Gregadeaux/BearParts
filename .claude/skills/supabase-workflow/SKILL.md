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
- **RLS philosophy:** the whole authenticated team can read and update parts (open
  shop-floor trust model); inserts must set `submitted_by = auth.uid()`; deletes are
  submitter-or-admin. Profiles auto-create via the `on_auth_user_created` trigger.
- **Storage:** all files live in the private `dxf` bucket (historical name).
  Quick queue uploads: `parts/<partId>.<ext>`. Library versions:
  `library/<libraryPartId>/v<n>.<ext>`. Task attachments (any format):
  `tasks/<taskId>/<uuid>/<safeName>`. Access via signed URLs only.
- **Library:** `folders` (tree, delete only when empty) → `library_parts` →
  `part_versions` (unique per part, latest = max version). Queue `parts` rows
  created from the library set `source_version_id` and SHARE the version's
  storage file — deletePartAction must never delete storage for those.
- **Auth:** Supabase Auth with Google OAuth. Redirect flows go through
  `/auth/callback` which exchanges the code and redirects home.
- **Realtime:** enabled on `public.parts`, `public.part_comments`,
  `public.tasks`, `public.task_comments`, `public.milestones`, and
  `public.notifications` (RLS scopes notification events to the recipient, so
  no channel filter is needed there). ALWAYS
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
