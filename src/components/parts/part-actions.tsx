"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Part, PartStatus, ProfileRow } from "@/types/part";
import {
  assignPartAction,
  deletePartAction,
  setArchivedAction,
  updateStatusAction,
} from "@/app/actions/parts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  part: Part;
  team: ProfileRow[];
  userId: string;
}

/** Claim / start / finish / assign controls for a part. */
export function PartActions({ part, team, userId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = part.status as PartStatus;

  const archived = Boolean(part.archived_at);

  const run = (fn: () => Promise<unknown>, message: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  if (archived) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => setArchivedAction(part.id, false), "Restored to the board")}
        >
          Restore
        </Button>
        <span className="text-sm text-muted-foreground">This part is archived.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "queued" && (
        <Button disabled={pending} onClick={() => run(() => assignPartAction(part.id, userId), "It's yours")}>
          Claim
        </Button>
      )}
      {(status === "assigned" || status === "queued") && (
        <Button
          variant={status === "assigned" ? "default" : "secondary"}
          disabled={pending}
          onClick={() => run(() => updateStatusAction(part.id, "in_progress"), "Marked in progress")}
        >
          Start
        </Button>
      )}
      {status === "in_progress" && (
        <Button disabled={pending} onClick={() => run(() => updateStatusAction(part.id, "done"), "Done! 🎉")}>
          Finish
        </Button>
      )}
      {status === "done" && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => updateStatusAction(part.id, "in_progress"), "Reopened")}
        >
          Reopen
        </Button>
      )}

      <Select
        value={part.assigned_to ?? "unassigned"}
        items={[
          { value: "unassigned", label: "Unassigned" },
          ...team.map((m) => ({ value: m.id, label: m.display_name })),
        ]}
        onValueChange={(v) =>
          run(
            () => assignPartAction(part.id, v === "unassigned" ? null : v),
            v === "unassigned" ? "Back in the queue" : "Assigned",
          )
        }
      >
        <SelectTrigger className="w-40" disabled={pending}>
          <SelectValue placeholder="Assign to…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {team.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setArchivedAction(part.id, true), "Archived")}
      >
        Archive
      </Button>

      <Button
        variant={confirmDelete ? "destructive" : "ghost"}
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          run(async () => {
            await deletePartAction(part.id);
            router.push("/board");
          }, "Part deleted");
        }}
        onBlur={() => setConfirmDelete(false)}
      >
        {confirmDelete ? "Really delete?" : "Delete"}
      </Button>
    </div>
  );
}
