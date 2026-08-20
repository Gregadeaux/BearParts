"use client";

import { format, parseISO } from "date-fns";
import { Flag } from "lucide-react";
import type { Task } from "@/types/task";
import type { MilestoneRow } from "@/services/milestones.service";
import { cn } from "@/lib/utils";
import { NO_SUBGROUP_COLOR } from "./task-chip";

interface Props {
  /** yyyy-MM-dd */
  day: string;
  tasks: Task[];
  milestones: MilestoneRow[];
  onOpenTask: (task: Task) => void;
  onOpenMilestone: (milestone: MilestoneRow) => void;
  onAddTask: (day: string) => void;
}

/** Phone agenda for the tapped day — the mobile stand-in for chips. */
export function AgendaList({ day, tasks, milestones, onOpenTask, onOpenMilestone, onAddTask }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-medium">{format(parseISO(day), "EEE, MMM d")}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onAddTask(day)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Task
        </button>
      </div>
      {milestones.map((milestone) => (
        <button
          key={milestone.id}
          type="button"
          onClick={() => onOpenMilestone(milestone)}
          className="flex w-full items-center gap-2 border-t bg-amber-50 px-3 py-2 text-left dark:bg-amber-950/40"
        >
          <Flag className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-amber-800 dark:text-amber-300">
            {milestone.title}
          </span>
        </button>
      ))}
      {tasks.length === 0 && milestones.length === 0 ? (
        <p className="border-t px-3 py-3 text-xs text-muted-foreground">Nothing on this day.</p>
      ) : (
        tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onOpenTask(task)}
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-left"
          >
            <span
              className="h-6 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: task.subgroup?.color || NO_SUBGROUP_COLOR }}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                task.status === "done" && "line-through opacity-50",
              )}
            >
              {task.title}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
