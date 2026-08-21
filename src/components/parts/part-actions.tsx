"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { methodMeta, PART_METHODS, type Part, type PartMethod, type PartStatus, type ProfileRow } from "@/types/part";
import {
  assignPartAction,
  deletePartAction,
  setArchivedAction,
  updateMethodAction,
  updateStatusAction,
} from "@/app/actions/parts";
import { STATUS_LABELS } from "./status-badge";
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

  const lanes = methodMeta(part.method).lanes;
  const laneIndex = lanes.indexOf(status);
  const nextLane = laneIndex >= 0 && laneIndex < lanes.length - 1 ? lanes[laneIndex + 1] : null;
  const stageOptions: PartStatus[] = [...lanes, "rejected"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!part.assigned_to && status !== "done" && status !== "rejected" && (
        <Button disabled={pending} onClick={() => run(() => assignPartAction(part.id, userId), "It's yours")}>
          Claim
        </Button>
      )}
      {nextLane && (
        <Button
          disabled={pending}
          onClick={() =>
            run(
              () => updateStatusAction(part.id, nextLane),
              nextLane === "done" ? "Done! 🎉" : `Moved to ${STATUS_LABELS[nextLane]}`,
            )
          }
        >
          {nextLane === "done" ? "Finish" : `→ ${STATUS_LABELS[nextLane]}`}
        </Button>
      )}
      {(status === "done" || status === "rejected") && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => updateStatusAction(part.id, "in_progress"), "Reopened")}
        >
          Reopen
        </Button>
      )}

      <Select
        value={status}
        items={stageOptions.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        onValueChange={(v) => {
          if (!v || v === status) return;
          run(
            () =>
              v === "queued"
                ? assignPartAction(part.id, null)
                : updateStatusAction(part.id, v as PartStatus),
            `Moved to ${STATUS_LABELS[v as PartStatus]}`,
          );
        }}
      >
        <SelectTrigger className="w-40" disabled={pending}>
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={part.method}
        items={PART_METHODS.map((m) => ({ value: m.value, label: m.label }))}
        onValueChange={(v) => {
          if (!v || v === part.method) return;
          run(() => updateMethodAction(part.id, v as PartMethod), `Now on the ${v === "print" ? "3DP" : v.toUpperCase()} flow`);
        }}
      >
        <SelectTrigger className="w-28" disabled={pending}>
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          {PART_METHODS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={part.assigned_to ?? "unassigned"}
        items={[
          { value: "unassigned", label: "Unassigned" },
          ...team.map((m) => ({ value: m.id, label: m.display_name })),
        ]}
        onValueChange={(v) => {
          const next = v ?? "unassigned"; // Base UI can hand back null
          run(
            () => assignPartAction(part.id, next === "unassigned" ? null : next),
            next === "unassigned" ? "Back in the queue" : "Assigned",
          );
        }}
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
