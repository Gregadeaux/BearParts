"use client";

import { useCallback, useMemo, useState } from "react";
import type { Task } from "@/types/task";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { listTasks } from "@/services/tasks.service";

export interface CalendarFilterState {
  subgroupIds: string[];
  assigneeIds: string[];
  mine: boolean;
}

const EMPTY: CalendarFilterState = { subgroupIds: [], assigneeIds: [], mine: false };

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Live task list plus the calendar's filter state (subgroup / assignee / mine). */
export function useCalendarTasks(initialTasks: Task[], userId: string | null) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filters, setFilters] = useState<CalendarFilterState>(EMPTY);

  useLiveTable({
    table: "tasks",
    onChange: () => listTasks(createClient()).then(setTasks).catch(console.error),
  });

  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        if (filters.subgroupIds.length > 0) {
          if (!task.subgroup_id || !filters.subgroupIds.includes(task.subgroup_id)) return false;
        }
        if (filters.assigneeIds.length > 0) {
          if (!task.assignees.some((a) => filters.assigneeIds.includes(a.id))) return false;
        }
        if (filters.mine && !task.assignees.some((a) => a.id === userId)) return false;
        return true;
      }),
    [tasks, filters, userId],
  );

  const toggleSubgroup = useCallback(
    (id: string) => setFilters((f) => ({ ...f, subgroupIds: toggle(f.subgroupIds, id) })),
    [],
  );
  const toggleAssignee = useCallback(
    (id: string) => setFilters((f) => ({ ...f, assigneeIds: toggle(f.assigneeIds, id) })),
    [],
  );
  const toggleMine = useCallback(() => setFilters((f) => ({ ...f, mine: !f.mine })), []);

  return { tasks, setTasks, visible, filters, toggleSubgroup, toggleAssignee, toggleMine };
}
