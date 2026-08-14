"use client";

import { useCallback, useState } from "react";
import type { SubgroupRow, Task, TaskStatus } from "@/types/task";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { listTasks } from "@/services/tasks.service";
import { STATUS_META, STATUS_ORDER } from "./task-utils";

export type GroupBy = "status" | "subgroup";

export interface TaskFilters {
  query: string;
  subgroupIds: string[];
  assigneeIds: string[];
  tags: string[];
  mine: boolean;
}

export const EMPTY_FILTERS: TaskFilters = {
  query: "",
  subgroupIds: [],
  assigneeIds: [],
  tags: [],
  mine: false,
};

/** One rendered section of the list. */
export interface TaskGroup {
  key: string;
  label: string;
  /** dot (status) or bar (subgroup) color; null for "No subgroup" */
  color: string | null;
  tasks: Task[];
  openByDefault: boolean;
  /** prefilled fields for this group's quick-add row */
  defaults: { status?: TaskStatus; subgroupId?: string | null };
}

/** Live task list — server data first, then realtime + focus/poll refetches. */
export function useTasks(initialTasks: Task[]) {
  const [tasks, setTasks] = useState(initialTasks);

  const refetch = useCallback(() => {
    listTasks(createClient()).then(setTasks).catch(console.error);
  }, []);

  useLiveTable({ table: "tasks", onChange: refetch });

  return { tasks, setTasks, refetch };
}

/** Toolbar filters, all ANDed together. */
export function filterTasks(tasks: Task[], filters: TaskFilters, userId: string): Task[] {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (query && !t.title.toLowerCase().includes(query)) return false;
    if (filters.subgroupIds.length && !filters.subgroupIds.includes(t.subgroup_id ?? "none")) return false;
    if (filters.tags.length && !filters.tags.some((tag) => t.tags.includes(tag))) return false;
    const assignees = t.assignees.map((a) => a.id);
    if (filters.assigneeIds.length && !filters.assigneeIds.some((id) => assignees.includes(id))) return false;
    if (filters.mine && !assignees.includes(userId)) return false;
    return true;
  });
}

/** Split into collapsible sections; empty sections stay so quick-add works. */
export function groupTasks(tasks: Task[], groupBy: GroupBy, subgroups: SubgroupRow[]): TaskGroup[] {
  if (groupBy === "status") {
    return STATUS_ORDER.map((status) => ({
      key: status,
      label: STATUS_META[status].label,
      color: STATUS_META[status].color,
      tasks: tasks.filter((t) => t.status === status),
      openByDefault: status !== "done",
      defaults: { status },
    }));
  }

  const groups: TaskGroup[] = subgroups.map((sub) => ({
    key: sub.id,
    label: sub.name,
    color: sub.color,
    tasks: tasks.filter((t) => t.subgroup_id === sub.id),
    openByDefault: true,
    defaults: { subgroupId: sub.id },
  }));

  groups.push({
    key: "none",
    label: "No subgroup",
    color: null,
    tasks: tasks.filter((t) => !t.subgroup_id),
    openByDefault: true,
    defaults: { subgroupId: null },
  });

  return groups;
}
