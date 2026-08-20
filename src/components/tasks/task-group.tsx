"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { Task, TaskStatus } from "@/types/task";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TaskRow } from "./task-row";
import type { GroupBy, TaskGroup as TaskGroupData } from "./use-tasks";

interface Props {
  group: TaskGroupData;
  groupBy: GroupBy;
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
  onQuickAdd: (title: string, defaults: TaskGroupData["defaults"]) => void;
}

/** Collapsible section of the list, with an inline quick-add row. */
export function TaskGroup({ group, groupBy, onOpen, onStatusChange, onDelete, onQuickAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const commit = () => {
    const value = title.trim();
    if (value) onQuickAdd(value, group.defaults);
    setTitle("");
    setAdding(false);
  };

  return (
    <Collapsible defaultOpen={group.openByDefault} className="space-y-1">
      <CollapsibleTrigger className="group/head flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/50">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/head:rotate-90" />
        {groupBy === "status" ? (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: group.color ?? "var(--color-muted-foreground)" }}
          />
        ) : (
          <span
            aria-hidden
            className="h-4 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: group.color ?? "var(--color-border)" }}
          />
        )}
        <span className="truncate text-sm font-semibold">{group.label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {group.tasks.length}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-1 pl-1">
        {group.tasks.length === 0 && !adding && (
          <p className="ml-3 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No tasks here yet.
          </p>
        )}
        {group.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}

        {adding ? (
          <Input
            autoFocus
            value={title}
            placeholder="Task title, then Enter"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setTitle("");
                setAdding(false);
              }
            }}
            className="ml-3 h-8 w-[calc(100%-0.75rem)] text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-md py-1.5 pl-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add task
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
