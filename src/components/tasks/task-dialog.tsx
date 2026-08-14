"use client";

import * as React from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Person, ProjectRow, SubgroupRow, Task, TaskStatus } from "@/types/task";
import {
  addSubtaskAction,
  createTaskAction,
  deleteSubtaskAction,
  deleteTaskAction,
  setSubtaskDoneAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useMediaQuery } from "@/lib/use-media-query";
import { randomId } from "@/lib/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
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
import { TagInput } from "./tag-input";
import { SubtaskList, type SubtaskItem } from "./subtask-list";
import { TaskFormFields, type TaskDraft } from "./task-form-fields";

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null/undefined creates a new task */
  task?: Task | null;
  defaults?: {
    status?: TaskStatus;
    subgroupId?: string | null;
    projectId?: string | null;
    dueDate?: string | null;
    startDate?: string | null;
  };
  team: Person[];
  subgroups: SubgroupRow[];
  projects: ProjectRow[];
  allTags: string[];
}

function emptyDraft(defaults: TaskDialogProps["defaults"]): TaskDraft {
  return {
    title: "",
    description: "",
    status: defaults?.status ?? "todo",
    subgroupId: defaults?.subgroupId ?? null,
    projectId: defaults?.projectId ?? null,
    assigneeIds: [],
    tags: [],
    startDate: defaults?.startDate ?? null,
    dueDate: defaults?.dueDate ?? null,
  };
}

function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    subgroupId: task.subgroup_id,
    projectId: task.project_id,
    assigneeIds: task.assignees.map((a) => a.id),
    tags: task.tags,
    startDate: task.start_date,
    dueDate: task.due_date,
  };
}

/** Create/edit a task. Dialog on desktop, drawer on phones. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
  team,
  subgroups,
  projects,
  allTags,
}: TaskDialogProps): React.JSX.Element {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(defaults));
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [created, setCreated] = useState<SubgroupRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const wasOpen = useRef(false);

  // reset only on the closed → open transition (props identity churns otherwise)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(task ? draftFromTask(task) : emptyDraft(defaults));
      setSubtasks(task ? task.subtasks.map(({ id, title, done }) => ({ id, title, done })) : []);
    }
    wasOpen.current = open;
  }, [open, task, defaults]);

  // edit mode syncs subtasks to the server immediately; create mode holds them locally
  const addSubtask = (title: string) => {
    const temp: SubtaskItem = { id: randomId(), title, done: false };
    setSubtasks((s) => [...s, temp]);
    if (!task) return;
    addSubtaskAction(task.id, title, subtasks.length)
      .then((saved) => setSubtasks((s) => s.map((x) => (x.id === temp.id ? { ...x, id: saved.id } : x))))
      .catch(() => {
        toast.error("Could not add subtask");
        setSubtasks((s) => s.filter((x) => x.id !== temp.id));
      });
  };

  const toggleSubtask = (id: string, done: boolean) => {
    setSubtasks((s) => s.map((x) => (x.id === id ? { ...x, done } : x)));
    if (!task) return;
    setSubtaskDoneAction(id, done).catch(() => {
      toast.error("Could not update subtask");
      setSubtasks((s) => s.map((x) => (x.id === id ? { ...x, done: !done } : x)));
    });
  };

  const removeSubtask = (id: string) => {
    const removed = subtasks.find((x) => x.id === id);
    setSubtasks((s) => s.filter((x) => x.id !== id));
    if (!task) return;
    deleteSubtaskAction(id).catch(() => {
      toast.error("Could not remove subtask");
      if (removed) setSubtasks((s) => [...s, removed]);
    });
  };

  const patch = (p: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...p }));
  const known = new Set(subgroups.map((s) => s.id));
  const allSubgroups = [...subgroups, ...created.filter((s) => !known.has(s.id))];

  const save = () =>
    startTransition(async () => {
      const title = draft.title.trim();
      if (!title) return;
      const input = {
        title,
        description: draft.description,
        status: draft.status,
        subgroupId: draft.subgroupId,
        projectId: draft.projectId,
        startDate: draft.startDate,
        dueDate: draft.dueDate,
      };
      try {
        if (task) {
          await updateTaskAction(task.id, input, draft.assigneeIds, draft.tags);
        } else {
          const { id } = await createTaskAction(input, draft.assigneeIds, draft.tags);
          // locally staged subtasks land after the task exists
          for (const [i, sub] of subtasks.entries()) {
            const saved = await addSubtaskAction(id, sub.title, i);
            if (sub.done) await setSubtaskDoneAction(saved.id, true);
          }
        }
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save task");
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!task) return;
      try {
        await deleteTaskAction(task.id);
        setConfirming(false);
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete task");
      }
    });

  const body = (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Input
          autoFocus={!task}
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Task title"
          className="h-auto border-0 px-0 py-1 text-lg font-semibold focus-visible:ring-0"
        />
        <Textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Add details…"
          className="min-h-14 resize-none border-0 px-0 focus-visible:ring-0"
        />
        <TaskFormFields
          draft={draft}
          onChange={patch}
          team={team}
          subgroups={allSubgroups}
          projects={projects}
          onSubgroupCreated={(s) => setCreated((c) => [...c, s])}
        />
        <SubtaskList
          items={subtasks}
          onAdd={addSubtask}
          onToggle={toggleSubtask}
          onRemove={removeSubtask}
        />
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tags</span>
          <TagInput
            tags={draft.tags}
            suggestions={allTags}
            onChange={(tags) => patch({ tags })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/50 p-3">
        {task && (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            <Trash2 /> Delete
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button size="sm" disabled={pending || !draft.title.trim()} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{task?.title}</span> will be removed for
              good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const heading = task ? "Edit task" : "New task";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle className="sr-only">{heading}</DrawerTitle>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{heading}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}
