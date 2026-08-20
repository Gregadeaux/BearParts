"use client";

import { useState } from "react";
import type { Task } from "@/types/task";
import type { MilestoneRow } from "@/services/milestones.service";
import { cn } from "@/lib/utils";
import { tasksOnDay, type WeekLayout } from "./calendar-layout";
import { DayPopover } from "./day-popover";
import { MilestoneChip } from "./milestone-chip";
import { milestonesOnDay } from "./use-milestones";
import { TaskChip } from "./task-chip";

/** Lane height (chip + gap) — keep in sync with the cell min-height. */
const LANE_HEIGHT = "1.625rem";

interface Props {
  layout: WeekLayout;
  /** filtered tasks — the row picks out what it needs */
  tasks: Task[];
  milestones: MilestoneRow[];
  maxLanes: number;
  /** yyyy-MM of the month in view; other days render dimmed */
  monthKey: string;
  today: string;
  draggable: boolean;
  /** a chip is mid-drag — let pointer events fall through to the cells */
  dragging: boolean;
  onDayClick: (day: string) => void;
  onTaskClick: (task: Task) => void;
  onMilestoneClick: (milestone: MilestoneRow) => void;
  onTaskDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, day: string) => void;
}

/** One week of the month grid: day cells underneath, task bars laid over them. */
export function WeekRow({
  layout,
  tasks,
  milestones,
  maxLanes,
  monthKey,
  today,
  draggable,
  dragging,
  onDayClick,
  onTaskClick,
  onMilestoneClick,
  onTaskDragStart,
  onDragEnd,
  onDropTask,
}: Props) {
  const [overDay, setOverDay] = useState<string | null>(null);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  // milestones get their own row(s) above the task lanes, only in weeks that have them
  const dayMilestones = layout.days.map((day) => milestonesOnDay(milestones, day));
  const milestoneRows = Math.max(0, ...dayMilestones.map((list) => list.length));

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
              "min-h-32 cursor-pointer border-t border-l p-1 transition-colors first:border-l-0 hover:bg-muted/40",
              !day.startsWith(monthKey) && "bg-muted/30",
              day === today && "bg-accent/40",
              overDay === day && "ring-2 ring-primary/50 ring-inset",
            )}
            style={milestoneRows > 0 ? { minHeight: `${8 + milestoneRows * 1.625}rem` } : undefined}
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
        {dayMilestones.flatMap((list, col) =>
          list.map((milestone, idx) => (
            <div
              key={milestone.id}
              className={cn("min-w-0 px-0.5", dragging && "pointer-events-none")}
              style={{ gridColumn: col + 1, gridRow: idx + 1 }}
            >
              <MilestoneChip milestone={milestone} onClick={() => onMilestoneClick(milestone)} />
            </div>
          )),
        )}

        {layout.segments.map((seg) => {
          const task = byId.get(seg.taskId);
          if (!task) return null;
          return (
            <div
              key={seg.taskId}
              className="min-w-0 px-0.5"
              style={{
                gridColumn: `${seg.colStart + 1} / ${seg.colEnd + 2}`,
                gridRow: seg.lane + 1 + milestoneRows,
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
              style={{ gridColumn: col + 1, gridRow: maxLanes + 1 + milestoneRows }}
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
