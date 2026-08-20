"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Person, ProjectRow, SubgroupRow, Task, TaskStatus } from "@/types/task";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { TaskDialog, type TaskDialogProps } from "./task-dialog";
import { TaskFilters } from "./task-filters";
import { TaskGroup } from "./task-group";
import {
  EMPTY_FILTERS,
  filterTasks,
  groupTasks,
  useTasks,
  type GroupBy,
  type TaskFilters as Filters,
} from "./use-tasks";

interface Props {
  initialTasks: Task[];
  team: Person[];
  subgroups: SubgroupRow[];
  projects: ProjectRow[];
  allTags: string[];
  userId: string;
  /** `?task=<id>` — opens that task's dialog on load */
  openTaskId?: string;
  /** `?project=<id>` — scope the whole view to one project */
  projectId?: string;
}

interface DialogState {
  open: boolean;
  task: Task | null;
  defaults: TaskDialogProps["defaults"];
}

/** Live, filterable, grouped task list — optionally scoped to one project. */
export function TasksView({
  initialTasks,
  team,
  subgroups,
  projects,
  allTags,
  userId,
  openTaskId,
  projectId,
}: Props) {
  const router = useRouter();
  const { tasks, setTasks, refetch } = useTasks(initialTasks);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const scoped = projectId ? tasks.filter((t) => t.project_id === projectId) : tasks;
  // a `?task=<id>` link opens that task's dialog straight away
  const [dialog, setDialog] = useState<DialogState>(() => {
    const task = (openTaskId && initialTasks.find((t) => t.id === openTaskId)) || null;
    return { open: Boolean(task), task, defaults: {} };
  });

  const groups = useMemo(
    () => groupTasks(filterTasks(scoped, filters, userId), groupBy, subgroups),
    [scoped, filters, userId, groupBy, subgroups],
  );

  const closeDialog = (open: boolean) => {
    setDialog((d) => ({ ...d, open }));
    if (open) return;
    refetch();
    router.refresh(); // picks up new subgroups / tags
    if (openTaskId) router.replace(projectId ? `/tasks?project=${projectId}` : "/tasks");
  };

  const changeStatus = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await updateTaskAction(task.id, { status });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    }
  };

  const removeTask = async (task: Task) => {
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await deleteTaskAction(task.id);
      toast.success("Task deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete task");
      setTasks((ts) => [task, ...ts]);
    }
  };

  const quickAdd = async (title: string, defaults: DialogState["defaults"]) => {
    try {
      await createTaskAction(
        {
          title,
          status: defaults?.status,
          subgroupId: defaults?.subgroupId ?? null,
          projectId: projectId ?? null,
        },
        [],
        [],
      );
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add task");
    }
  };

  return (
    <div className="space-y-3">
      {activeProject && (
        <p className="text-sm text-muted-foreground">
          Project: <span className="font-medium text-foreground">{activeProject.name}</span>
        </p>
      )}
      <TaskFilters
        filters={filters}
        onFiltersChange={(p) => setFilters((f) => ({ ...f, ...p }))}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        team={team}
        subgroups={subgroups}
        allTags={allTags}
        onNewTask={() =>
          setDialog({ open: true, task: null, defaults: { projectId: projectId ?? null } })
        }
      />

      <div className="space-y-3">
        {groups.map((group) => (
          <TaskGroup
            key={`${groupBy}-${group.key}`}
            group={group}
            groupBy={groupBy}
            onOpen={(task) => setDialog({ open: true, task, defaults: {} })}
            onStatusChange={changeStatus}
            onDelete={removeTask}
            onQuickAdd={quickAdd}
          />
        ))}
      </div>

      <TaskDialog
        open={dialog.open}
        onOpenChange={closeDialog}
        task={dialog.task}
        defaults={dialog.defaults}
        team={team}
        subgroups={subgroups}
        projects={projects}
        allTags={allTags}
        userId={userId}
      />
    </div>
  );
}
