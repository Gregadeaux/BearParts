"use client";

import { Flag } from "lucide-react";
import type { Task } from "@/types/task";
import type { MilestoneRow } from "@/services/milestones.service";
import { cn } from "@/lib/utils";
import { tasksOnDay, type WeekLayout } from "./calendar-layout";
import { NO_SUBGROUP_COLOR } from "./task-chip";
import { milestonesOnDay } from "./use-milestones";
import { WeekRow } from "./week-row";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_DOTS = 3;

interface Props {
  layouts: WeekLayout[];
  tasks: Task[];
  milestones: MilestoneRow[];
  maxLanes: number;
  /** yyyy-MM of the month in view */
  monthKey: string;
  today: string;
  /** phone layout: dots instead of chips, tap a day to open the agenda */
  compact: boolean;
  selectedDay: string | null;
  dragging: boolean;
  onDayClick: (day: string) => void;
  onTaskClick: (task: Task) => void;
  onMilestoneClick: (milestone: MilestoneRow) => void;
  onTaskDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, day: string) => void;
}

/** The month matrix — chips-and-bars on desktop, dots on a phone. */
export function MonthGrid({ compact, ...props }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 bg-muted/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {compact ? d[0] : d}
          </div>
        ))}
      </div>
      {compact ? <CompactWeeks {...props} /> : <FullWeeks {...props} />}
    </div>
  );
}

type GridProps = Omit<Props, "compact">;

function FullWeeks({
  layouts,
  tasks,
  milestones,
  maxLanes,
  monthKey,
  today,
  dragging,
  onDayClick,
  onTaskClick,
  onMilestoneClick,
  onTaskDragStart,
  onDragEnd,
  onDropTask,
}: GridProps) {
  return (
    <>
      {layouts.map((layout) => (
        <WeekRow
          key={layout.days[0]}
          layout={layout}
          tasks={tasks}
          milestones={milestones}
          maxLanes={maxLanes}
          monthKey={monthKey}
          today={today}
          draggable
          dragging={dragging}
          onDayClick={onDayClick}
          onTaskClick={onTaskClick}
          onMilestoneClick={onMilestoneClick}
          onTaskDragStart={onTaskDragStart}
          onDragEnd={onDragEnd}
          onDropTask={onDropTask}
        />
      ))}
    </>
  );
}

function CompactWeeks({
  layouts,
  tasks,
  milestones,
  monthKey,
  today,
  selectedDay,
  onDayClick,
}: GridProps) {
  return (
    <div className="grid grid-cols-7">
      {layouts.flatMap((layout) =>
        layout.days.map((day, col) => {
          const dayTasks = tasksOnDay(tasks, day);
          const hasMilestone = milestonesOnDay(milestones, day).length > 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 border-t border-l p-1",
                col === 0 && "border-l-0",
                !day.startsWith(monthKey) && "bg-muted/30",
                day === today && "bg-accent/40",
                day === selectedDay && "ring-2 ring-primary/60 ring-inset",
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
              <span className="flex flex-wrap items-center justify-center gap-0.5">
                {hasMilestone && <Flag className="size-2.5 text-amber-600 dark:text-amber-400" />}
                {dayTasks.slice(0, MAX_DOTS).map((t) => (
                  <span
                    key={t.id}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: t.subgroup?.color || NO_SUBGROUP_COLOR }}
                  />
                ))}
                {dayTasks.length > MAX_DOTS && (
                  <span className="text-[10px] leading-none text-muted-foreground">
                    +{dayTasks.length - MAX_DOTS}
                  </span>
                )}
              </span>
            </button>
          );
        }),
      )}
    </div>
  );
}
