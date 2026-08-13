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
- **Storage:** all part files live in the private `dxf` bucket (historical name).
  Quick queue uploads: `parts/<partId>.<ext>`. Library versions:
  `library/<libraryPartId>/v<n>.<ext>`. Access via signed URLs only.
- **Library:** `folders` (tree, delete only when empty) → `library_parts` →
  `part_versions` (unique per part, latest = max version). Queue `parts` rows
  created from the library set `source_version_id` and SHARE the version's
  storage file — deletePartAction must never delete storage for those.
- **Auth:** Supabase Auth with Google OAuth. Redirect flows go through
  `/auth/callback` which exchanges the code and redirects home.
- Realtime is enabled on `public.parts` — the queue subscribes for live updates.
- `parts.analysis` stores the `DxfAnalysis` JSON computed at upload; treat it as a
  cache — the client can always recompute from the DXF.
