"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { Task } from "@/types/task";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDayKey } from "./calendar-layout";
import { NO_SUBGROUP_COLOR } from "./task-chip";

interface Props {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onSchedule: (taskId: string, day: string) => void;
}

/** Tasks with no dates yet — collapsible, each row can pick a due date. */
export function UnscheduledList({ tasks, onOpenTask, onSchedule }: Props) {
  return (
    <Collapsible defaultOpen className="rounded-lg border">
      <CollapsibleTrigger className="group/trigger flex w-full items-center gap-2 px-3 py-2 text-sm font-medium">
        <ChevronRightIcon className="size-4 transition-transform group-data-[panel-open]/trigger:rotate-90" />
        Unscheduled
        <span className="text-muted-foreground tabular-nums">{tasks.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {tasks.length === 0 ? (
          <p className="border-t px-3 py-3 text-xs text-muted-foreground">Nothing waiting.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 border-t px-3 py-2">
              <span
                className="h-6 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: task.subgroup?.color || NO_SUBGROUP_COLOR }}
              />
              <button
                type="button"
                onClick={() => onOpenTask(task)}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm hover:underline",
                  task.status === "done" && "line-through opacity-50",
                )}
              >
                {task.title}
              </button>
              <SchedulePopover onPick={(day) => onSchedule(task.id, day)} />
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SchedulePopover({ onPick }: { onPick: (day: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), "shrink-0")}
      >
        Schedule
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          autoFocus
          onSelect={(date: Date | undefined) => {
            if (!date) return;
            setOpen(false);
            onPick(toDayKey(date));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
