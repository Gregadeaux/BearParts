---
name: task-tracking
description: Conventions for the ClickUp-style task/calendar system (tasks, subgroups, tags). Use when touching src/app/tasks, src/app/calendar, or tasks.service.
---

# Task tracking conventions

Deliberately SEPARATE from the parts queue — no foreign keys between the two
domains. Tasks are high-level ("Fabricate the Intake"), parts are shop-floor.

1. **Statuses are fixed**, not configurable: `todo` (label "Not started"),
   `in_progress`, `blocked`, `done` — defined once in `TASK_STATUSES`
   (src/types/task.ts) with their dot colors. DB slug `todo` stays even though
   the label says "Not started" (renaming a CHECK-constrained slug isn't worth it).
2. **Color belongs to the subgroup, not the status.** Subgroup color drives chip
   fills / row stripes; status renders as a neutral badge with a colored dot.
   Done tasks render at ~50-55% opacity everywhere.
3. **Dates are plain `yyyy-MM-dd` strings** end to end. Compare as strings,
   parse with date-fns; never round-trip through `new Date(iso)` display in
   local time — that shifts days.
4. **Tags are free-form**, global, lowercase-trimmed-deduped, max 8/task, stored
   in `task_tags`; suggestions come from `listAllTags`.
5. **Multiple assignees** via `task_assignees`; `setAssignees` replaces the set
   and returns newly-added ids — actions push-notify those (never the actor).
6. Realtime lives on `public.tasks` and `public.task_comments` —
   assignee/tag/subtask/attachment edits don't emit task events, so mutations
   should go through the server actions (which revalidate) and views refetch
   via `useLiveTable`.
7. **Attachments** accept any file format, stored in the shared private bucket
   at `tasks/{taskId}/{uuid}/{safeName}` (`task_attachments` rows joined into
   `TASK_SELECT`). Only dxf/stl/pdf get the preview modal
   (`FilePreviewDialog` reuses the three workspaces); everything else is
   download-only. Downloads use signed URLs with the `download` option so the
   original file name survives. Create-mode dialogs stage `File` objects
   locally and upload after `createTaskAction` returns the id (same pattern
   as staged subtasks).
8. **Comments** mirror `part_comments` exactly (RLS, mention tokens, push on
   mention with url `/tasks?task=<id>`); the dialog reuses `MentionComposer`
   / `CommentBody` with `versions=[]`.
9. v1 skip list (don't add without a decision): time tracking, custom fields,
   recurring tasks, dependencies, priorities, week/day calendar views,
   drag-reorder within groups, external calendar sync.
