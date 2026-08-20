"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Flag } from "lucide-react";
import type { MilestoneRow } from "@/services/milestones.service";
import { formatDay } from "@/components/tasks/task-utils";

const MAX_SHOWN = 3;

function countdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

interface Props {
  milestones: MilestoneRow[];
  today: string;
  /** jump the calendar to the milestone's month */
  onSelect: (milestone: MilestoneRow) => void;
}

/** "Kickoff · in 12d" countdown chips for the next few milestones. */
export function MilestoneStrip({ milestones, today, onSelect }: Props) {
  const upcoming = milestones.filter((m) => m.date >= today).slice(0, MAX_SHOWN);
  if (upcoming.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {upcoming.map((m) => {
        const days = differenceInCalendarDays(parseISO(m.date), parseISO(today));
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            title={formatDay(m.date)}
            className="flex items-center gap-1.5 rounded-full bg-amber-100 py-1 pr-2.5 pl-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
          >
            <Flag className="size-3" />
            <span className="max-w-40 truncate">{m.title}</span>
            <span className="font-normal opacity-75">{countdown(days)}</span>
          </button>
        );
      })}
    </div>
  );
}
