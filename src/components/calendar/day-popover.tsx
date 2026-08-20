"use client";

import { format, parseISO } from "date-fns";
import type { Task } from "@/types/task";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chipStyle } from "./task-chip";

interface Props {
  /** yyyy-MM-dd */
  day: string;
  /** every task on that day, layout order */
  tasks: Task[];
  /** how many did not fit in the cell */
  hiddenCount: number;
  onSelect: (task: Task) => void;
}

/** "+N more" for a crowded day — lists that day's tasks, each row opens the editor. */
export function DayPopover({ day, tasks, hiddenCount, onSelect }: Props) {
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label={`${hiddenCount} more tasks on ${format(parseISO(day), "EEE, MMM d")}`}
        className="pointer-events-auto w-full truncate rounded px-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted"
      >
        +{hiddenCount} more
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1.5">
        <p className="px-0.5 text-xs font-medium">{format(parseISO(day), "EEE, MMM d")}</p>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              style={chipStyle(task.subgroup?.color)}
              onClick={() => onSelect(task)}
              className={cn(
                "flex h-6 items-center overflow-hidden rounded px-1.5 text-left text-xs transition-[filter] hover:brightness-105",
                task.status === "done" && "line-through opacity-50",
              )}
            >
              <span className="truncate">{task.title}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
