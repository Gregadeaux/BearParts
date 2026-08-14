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
6. Realtime lives on `public.tasks` only — assignee/tag-only edits don't emit
   task events, so mutations should go through the server actions (which
   revalidate) and views refetch via `useLiveTable`.
7. v1 skip list (don't add without a decision): time tracking, custom fields,
   recurring tasks, dependencies, subtasks, priorities, comments, week/day
   calendar views, drag-reorder within groups, external calendar sync.
