"use client";

import { useState } from "react";
import { CheckSquare2, MoreHorizontal, Paperclip } from "lucide-react";
import type { Task, TaskStatus } from "@/types/task";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarStack } from "./avatar-stack";
import { StatusDot, StatusSelect } from "./status-select";
import { formatDay, isOverdue } from "./task-utils";

interface Props {
  task: Task;
  onOpen: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
}

/** One task: single line on desktop, two-line card on phones. */
export function TaskRow({ task, onOpen, onStatusChange, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const done = task.status === "done";
  const overdue = isOverdue(task.due_date, task.status);
  const stripe = task.subgroup?.color ?? "transparent";
  const due = task.due_date ? formatDay(task.due_date) : "";
  const dueClass = overdue
    ? "font-bold text-destructive"
    : done
      ? "text-muted-foreground/70"
      : "text-muted-foreground";

  return (
    <>
      {/* desktop */}
      <div
        className={cn(
          "group relative hidden items-center gap-2 rounded-md py-1 pr-1 pl-3 transition-colors hover:bg-muted/50 sm:flex",
          done && "opacity-55",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-1 rounded-full"
          style={{ backgroundColor: stripe }}
        />
        <StatusSelect status={task.status} onChange={(s) => onStatusChange(task, s)} />
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 truncate py-1 text-left text-sm hover:underline"
        >
          {task.title}
        </button>
        <SubtaskCount task={task} />
        <AttachmentCount task={task} />
        <TagBadges tags={task.tags} />
        <AvatarStack people={task.assignees} />
        <span className={cn("w-12 shrink-0 text-right text-xs tabular-nums", dueClass)}>{due}</span>
        <RowMenu onEdit={() => onOpen(task)} onDelete={() => setConfirming(true)} />
      </div>

      {/* mobile */}
      <button
        type="button"
        onClick={() => onOpen(task)}
        className={cn(
          "relative flex w-full flex-col gap-1.5 rounded-lg border bg-card py-2 pr-2.5 pl-3 text-left transition-colors active:bg-muted/50 sm:hidden",
          done && "opacity-55",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-1 rounded-full"
          style={{ backgroundColor: stripe }}
        />
        <span className="flex items-center gap-2">
          <StatusDot status={task.status} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
        </span>
        <span className="flex items-center gap-2 text-xs">
          {task.subgroup && (
            <Badge
              variant="outline"
              className="gap-1"
              style={{ borderColor: `${task.subgroup.color}66` }}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: task.subgroup.color }}
              />
              {task.subgroup.name}
            </Badge>
          )}
          {due && <span className={dueClass}>{due}</span>}
          <SubtaskCount task={task} />
          <AvatarStack people={task.assignees} max={3} className="ml-auto" />
        </span>
      </button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{task.title}</span> will be removed for
              good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onDelete(task);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SubtaskCount({ task }: { task: Task }) {
  if (task.subtasks.length === 0) return null;
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 text-xs tabular-nums text-muted-foreground"
      title={`${done} of ${task.subtasks.length} subtasks done`}
    >
      <CheckSquare2 className="size-3.5" />
      {done}/{task.subtasks.length}
    </span>
  );
}

function AttachmentCount({ task }: { task: Task }) {
  if (task.attachments.length === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 text-xs tabular-nums text-muted-foreground"
      title={`${task.attachments.length} attachments`}
    >
      <Paperclip className="size-3.5" />
      {task.attachments.length}
    </span>
  );
}

function TagBadges({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, 2);
  const extra = tags.length - shown.length;
  return (
    <span className="hidden shrink-0 items-center gap-1 md:flex">
      {shown.map((tag) => (
        <Badge key={tag} variant="secondary" className="max-w-24 truncate">
          {tag}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="ghost" className="text-muted-foreground">
          +{extra}
        </Badge>
      )}
    </span>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" nativeButton />}
        aria-label="Task actions"
        className="opacity-0 transition-opacity group-hover:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
