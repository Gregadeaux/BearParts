"use client";

import { format, parseISO } from "date-fns";
import type { Task } from "@/types/task";
import { cn } from "@/lib/utils";
import { NO_SUBGROUP_COLOR } from "./task-chip";

interface Props {
  /** yyyy-MM-dd */
  day: string;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onAddTask: (day: string) => void;
}

/** Phone agenda for the tapped day — the mobile stand-in for chips. */
export function AgendaList({ day, tasks, onOpenTask, onAddTask }: Props) {
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
      {tasks.length === 0 ? (
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
