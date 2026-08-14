"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SubgroupRow } from "@/types/task";
import { createSubgroupAction } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBGROUP_COLORS } from "./task-utils";

const NONE = "none";
const NEW = "__new";

interface Props {
  subgroups: SubgroupRow[];
  value: string | null;
  onChange: (subgroupId: string | null) => void;
  /** a freshly created subgroup, so the caller can merge it into its list */
  onCreated: (subgroup: SubgroupRow) => void;
}

/** Subgroup picker with an inline "+ New subgroup" creator. */
export function SubgroupSelect({ subgroups, value, onChange, onCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SUBGROUP_COLORS[0]);
  const [pending, startTransition] = useTransition();

  const items = [
    { value: NONE, label: "No subgroup" },
    ...subgroups.map((s) => ({ value: s.id, label: s.name })),
    { value: NEW, label: "+ New subgroup" },
  ];

  const create = () =>
    startTransition(async () => {
      if (!name.trim()) return;
      try {
        const subgroup = await createSubgroupAction(name, color);
        onCreated(subgroup);
        onChange(subgroup.id);
        setName("");
        setCreating(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create subgroup");
      }
    });

  return (
    <div className="space-y-1.5">
      <Select
        value={value ?? NONE}
        items={items}
        onValueChange={(v) => {
          if (v === NEW) return setCreating(true);
          onChange(v === NONE || v === null ? null : v);
        }}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No subgroup</SelectItem>
          {subgroups.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW}>+ New subgroup</SelectItem>
        </SelectContent>
      </Select>

      {creating && (
        <div className="space-y-1.5 rounded-lg border p-2">
          <Input
            autoFocus
            value={name}
            placeholder="Subgroup name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {SUBGROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "size-5 rounded-full ring-offset-2 ring-offset-background",
                  c === color && "ring-2 ring-foreground/40",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={pending || !name.trim()} onClick={create}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
