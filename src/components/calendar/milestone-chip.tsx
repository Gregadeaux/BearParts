"use client";

import { Flag } from "lucide-react";
import type { MilestoneRow } from "@/services/milestones.service";
import { cn } from "@/lib/utils";

/** One milestone flag in a week row — amber everywhere, distinct from task bars. */
export function MilestoneChip({
  milestone,
  onClick,
  className,
}: {
  milestone: MilestoneRow;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={milestone.title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "pointer-events-auto flex h-6 w-full items-center gap-1 overflow-hidden rounded bg-amber-100 px-1.5 text-left text-xs font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900",
        className,
      )}
    >
      <Flag className="size-3 shrink-0" />
      <span className="truncate">{milestone.title}</span>
    </button>
  );
}
