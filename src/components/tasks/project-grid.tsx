"use client";

import Link from "next/link";
import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import type { Person, ProjectRow, Task } from "@/types/task";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./avatar-stack";
import { NewProjectDialog } from "./new-project-dialog";
import { isOverdue, STATUS_META } from "./task-utils";
import { useTasks } from "./use-tasks";

interface Props {
  projects: ProjectRow[];
  initialTasks: Task[];
}

/** Tasks landing page: one KPI card per project (plus orphans, if any exist). */
export function ProjectGrid({ projects, initialTasks }: Props) {
  const { tasks } = useTasks(initialTasks);
  const [creating, setCreating] = useState(false);
  const orphans = tasks.filter((t) => t.project_id === null);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          name={project.name}
          href={`/tasks?project=${project.id}`}
          tasks={tasks.filter((t) => t.project_id === project.id)}
        />
      ))}
      {orphans.length > 0 && (
        <ProjectCard name="No project" href="/tasks?project=none" tasks={orphans} muted />
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <Plus className="size-5" />
        New project
      </button>

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function ProjectCard({
  name,
  href,
  tasks,
  muted = false,
}: {
  name: string;
  href: string;
  tasks: Task[];
  muted?: boolean;
}) {
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const people = new Map<string, Person>();
  for (const task of tasks) for (const a of task.assignees) people.set(a.id, a);

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-32 flex-col gap-2.5 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50",
        muted && "border-dashed",
      )}
    >
      <div className="flex items-center gap-2">
        <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        <AvatarStack people={[...people.values()]} max={4} />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            {done}/{tasks.length} done
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Kpi color={STATUS_META.in_progress.color} label={`${inProgress} in progress`} />
        <Kpi color={STATUS_META.blocked.color} label={`${blocked} blocked`} />
        {overdue > 0 && (
          <span className="font-medium text-destructive">{overdue} overdue</span>
        )}
      </div>
    </Link>
  );
}

function Kpi({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
