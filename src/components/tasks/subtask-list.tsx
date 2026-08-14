"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

interface Props {
  items: SubtaskItem[];
  onAdd: (title: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}

/** Checklist inside the task dialog: toggle, remove, quick-add on Enter. */
export function SubtaskList({ items, onAdd, onToggle, onRemove }: Props) {
  const [draft, setDraft] = useState("");
  const doneCount = items.filter((s) => s.done).length;

  const commit = () => {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
  };

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">
        Subtasks
        {items.length > 0 && (
          <span className="ml-1.5 tabular-nums">
            {doneCount}/{items.length}
          </span>
        )}
      </span>

      {items.length > 0 && (
        <ul className="space-y-0.5">
          {items.map((subtask) => (
            <li key={subtask.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60">
              <Checkbox
                checked={subtask.done}
                onCheckedChange={(checked) => onToggle(subtask.id, checked === true)}
                aria-label={subtask.title}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  subtask.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                aria-label={`Remove "${subtask.title}"`}
                onClick={() => onRemove(subtask.id)}
                className="hidden text-muted-foreground hover:text-destructive group-hover:block"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 px-1">
        <Plus className="size-3.5 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder="Add subtask"
          className="h-7 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
