"use client";

import type { CSSProperties, DragEvent } from "react";
import type { Task } from "@/types/task";
import { cn } from "@/lib/utils";

/** Neutral zinc for tasks with no subgroup. */
export const NO_SUBGROUP_COLOR = "#71717a";

/** A subgroup hex → 15% tint fill plus a solid 3px left rule. */
export function chipStyle(color: string | null | undefined): CSSProperties {
  const hue = color || NO_SUBGROUP_COLOR;
  return {
    backgroundColor: `color-mix(in srgb, ${hue} 15%, transparent)`,
    borderLeft: `3px solid ${hue}`,
  };
}

interface Props {
  task: Task;
  /** bar started in an earlier week — square that edge */
  continuesLeft?: boolean;
  /** bar runs into the next week — square that edge */
  continuesRight?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: DragEvent) => void;
  className?: string;
}

/** One task bar/chip in a week row. Spans get square edges where they continue. */
export function TaskChip({
  task,
  continuesLeft,
  continuesRight,
  draggable,
  onClick,
  onDragStart,
  className,
}: Props) {
  return (
    <button
      type="button"
      title={task.title}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={chipStyle(task.subgroup?.color)}
      className={cn(
        "pointer-events-auto flex h-6 w-full items-center overflow-hidden rounded px-1.5 text-left text-xs transition-[filter] hover:brightness-105",
        draggable && "cursor-grab active:cursor-grabbing",
        continuesLeft && "rounded-l-none",
        continuesRight && "rounded-r-none",
        task.status === "done" && "line-through opacity-50",
        className,
      )}
    >
      <span className="truncate">{task.title}</span>
    </button>
  );
}
