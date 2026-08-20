"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { SubgroupRow } from "@/types/task";
import {
  createSubgroupAction,
  deleteSubgroupAction,
  updateSubgroupAction,
} from "@/app/actions/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { SUBGROUP_COLORS } from "./task-utils";

interface Props {
  initialSubgroups: SubgroupRow[];
  /** subgroup id → task count, for context in the list and delete confirms */
  taskCounts: Record<string, number>;
}

/** Admin list: rename inline, recolor via swatch popover, create, delete. */
export function SubgroupManager({ initialSubgroups, taskCounts }: Props) {
  const [subgroups, setSubgroups] = useState(initialSubgroups);
  const [deleting, setDeleting] = useState<SubgroupRow | null>(null);
  const [pending, startTransition] = useTransition();

  const patchLocal = (id: string, patch: Partial<SubgroupRow>) =>
    setSubgroups((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const rename = (subgroup: SubgroupRow, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === subgroup.name) return;
    patchLocal(subgroup.id, { name: trimmed });
    updateSubgroupAction(subgroup.id, { name: trimmed }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Could not rename subgroup");
      patchLocal(subgroup.id, { name: subgroup.name });
    });
  };

  const recolor = (subgroup: SubgroupRow, color: string) => {
    if (color === subgroup.color) return;
    patchLocal(subgroup.id, { color });
    updateSubgroupAction(subgroup.id, { color }).catch(() => {
      toast.error("Could not change color");
      patchLocal(subgroup.id, { color: subgroup.color });
    });
  };

  const remove = () =>
    startTransition(async () => {
      if (!deleting) return;
      try {
        await deleteSubgroupAction(deleting.id);
        setSubgroups((list) => list.filter((s) => s.id !== deleting.id));
        toast.success(`"${deleting.name}" deleted`);
        setDeleting(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete subgroup");
      }
    });

  return (
    <div className="max-w-xl space-y-3">
      <div className="divide-y rounded-lg border">
        {subgroups.map((subgroup) => (
          <div
            key={subgroup.id}
            className="group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <ColorSwatch value={subgroup.color} onChange={(c) => recolor(subgroup, c)} />
            <NameField value={subgroup.name} onCommit={(name) => rename(subgroup, name)} />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {taskCounts[subgroup.id] ?? 0} tasks
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${subgroup.name}`}
              onClick={() => setDeleting(subgroup)}
              className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {subgroups.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            No subgroups yet — add one below.
          </p>
        )}
      </div>

      <CreateRow onCreated={(s) => setSubgroups((list) => [...list, s])} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subgroup?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleting?.name}</span> will be removed.
              {(taskCounts[deleting?.id ?? ""] ?? 0) > 0 && (
                <>
                  {" "}
                  Its {taskCounts[deleting!.id]} task
                  {taskCounts[deleting!.id] === 1 ? "" : "s"} will be kept, just without a subgroup.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Round swatch that pops the fixed palette. */
function ColorSwatch({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" aria-label="Change color" />}
        className="size-5 shrink-0 rounded-full ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-foreground/30"
        style={{ backgroundColor: value }}
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex gap-1.5">
          {SUBGROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
              className={cn(
                "size-5 rounded-full ring-offset-2 ring-offset-background",
                color === value && "ring-2 ring-foreground/40",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Borderless input that commits a rename on blur or Enter. */
function NameField({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className="h-7 min-w-0 flex-1 border-0 px-1 text-sm font-medium shadow-none focus-visible:ring-1"
    />
  );
}

function CreateRow({ onCreated }: { onCreated: (subgroup: SubgroupRow) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBGROUP_COLORS[0]);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const subgroup = await createSubgroupAction(trimmed, color);
        onCreated(subgroup);
        toast.success(`"${subgroup.name}" created`);
        setName("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create subgroup");
      }
    });

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2">
      <ColorSwatch value={color} onChange={setColor} />
      <Input
        value={name}
        placeholder="New subgroup"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        className="h-7 min-w-0 flex-1 border-0 px-1 text-sm shadow-none focus-visible:ring-1"
      />
      <Button size="sm" variant="ghost" disabled={pending || !name.trim()} onClick={create}>
        <Plus /> Add
      </Button>
    </div>
  );
}
