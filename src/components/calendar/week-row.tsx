"use client";

import { useState } from "react";
import type { Task } from "@/types/task";
import { cn } from "@/lib/utils";
import { tasksOnDay, type WeekLayout } from "./calendar-layout";
import { DayPopover } from "./day-popover";
import { TaskChip } from "./task-chip";

/** Lane height (chip + gap) — keep in sync with the cell min-height. */
const LANE_HEIGHT = "1.625rem";

interface Props {
  layout: WeekLayout;
  /** filtered tasks — the row picks out what it needs */
  tasks: Task[];
  maxLanes: number;
  /** yyyy-MM of the month in view; other days render dimmed */
  monthKey: string;
  today: string;
  draggable: boolean;
  /** a chip is mid-drag — let pointer events fall through to the cells */
  dragging: boolean;
  onDayClick: (day: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, day: string) => void;
}

/** One week of the month grid: day cells underneath, task bars laid over them. */
export function WeekRow({
  layout,
  tasks,
  maxLanes,
  monthKey,
  today,
  draggable,
  dragging,
  onDayClick,
  onTaskClick,
  onTaskDragStart,
  onDragEnd,
  onDropTask,
}: Props) {
  const [overDay, setOverDay] = useState<string | null>(null);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="relative" onDragEnd={onDragEnd}>
      <div className="grid grid-cols-7">
        {layout.days.map((day) => (
          <div
            key={day}
            onClick={() => onDayClick(day)}
            onDragOver={(e) => {
              if (!draggable) return;
              e.preventDefault();
              setOverDay(day);
            }}
            onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              setOverDay(null);
              const id = e.dataTransfer.getData("text/task-id");
              if (id) onDropTask(id, day);
            }}
            className={cn(
              "min-h-32 border-t border-l p-1 first:border-l-0",
              !day.startsWith(monthKey) && "bg-muted/30",
              day === today && "bg-accent/40",
              overDay === day && "ring-2 ring-primary/50 ring-inset",
            )}
          >
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                !day.startsWith(monthKey) && "text-muted-foreground/50",
                day === today && "bg-primary font-medium text-primary-foreground",
              )}
            >
              {Number(day.slice(8))}
            </span>
          </div>
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 content-start"
        style={{ gridAutoRows: LANE_HEIGHT }}
      >
        {layout.segments.map((seg) => {
          const task = byId.get(seg.taskId);
          if (!task) return null;
          return (
            <div
              key={seg.taskId}
              className="min-w-0 px-0.5"
              style={{
                gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                gridRow: seg.lane + 1,
              }}
            >
              <TaskChip
                task={task}
                continuesLeft={seg.continuesLeft}
                continuesRight={seg.continuesRight}
                draggable={draggable}
                className={dragging ? "pointer-events-none" : undefined}
                onClick={() => onTaskClick(task)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/task-id", task.id);
                  e.dataTransfer.effectAllowed = "move";
                  onTaskDragStart(task.id);
                }}
              />
            </div>
          );
        })}

        {layout.overflow.map((ids, col) =>
          ids.length === 0 ? null : (
            <div
              key={layout.days[col]}
              className={cn("min-w-0 px-0.5", dragging && "pointer-events-none")}
              style={{ gridColumn: col + 1, gridRow: maxLanes + 1 }}
            >
              <DayPopover
                day={layout.days[col]}
                tasks={tasksOnDay(tasks, layout.days[col])}
                hiddenCount={ids.length}
                onSelect={onTaskClick}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
