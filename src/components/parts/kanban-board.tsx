"use client";

import { useState } from "react";
import { toast } from "sonner";
import { methodMeta, PART_METHODS, type Part, type PartMethod, type PartStatus } from "@/types/part";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { listParts } from "@/services/parts.service";
import { assignPartAction, deletePartAction, setArchivedAction, updateStatusAction } from "@/app/actions/parts";
import { KanbanColumn } from "./kanban-column";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BoardView = "all" | PartMethod;

interface Column {
  key: string;
  title: string;
  statuses: PartStatus[];
}

/** Cross-method view buckets the prep stages together. */
const ALL_COLUMNS: Column[] = [
  { key: "queued", title: "Queue", statuses: ["queued"] },
  { key: "prep", title: "Prep", statuses: ["toolpaths", "slicing", "saw"] },
  { key: "ready", title: "Ready", statuses: ["ready"] },
  { key: "in_progress", title: "In progress", statuses: ["in_progress"] },
  { key: "finishing", title: "Finishing", statuses: ["finishing"] },
  { key: "done", title: "Done", statuses: ["done", "rejected"] },
];

/** Lane titles read like the shop talks about each machine. */
const LANE_TITLES: Partial<Record<PartMethod, Partial<Record<PartStatus, string>>>> = {
  cnc: { ready: "Ready for CNC", in_progress: "Routing" },
  laser: { in_progress: "Cutting" },
  print: { slicing: "Needs slicing", ready: "Ready to print", in_progress: "Printing" },
};

function columnsFor(view: BoardView): Column[] {
  if (view === "all") return ALL_COLUMNS;
  return methodMeta(view).lanes.map((lane) => ({
    key: lane,
    title:
      LANE_TITLES[view]?.[lane] ??
      { queued: "Queue", toolpaths: "Needs toolpaths", saw: "Cut to length", ready: "Ready", in_progress: "In progress", finishing: "Finishing", done: "Done" }[lane as string] ??
      lane,
    statuses: lane === "done" ? ["done", "rejected"] : [lane],
  }));
}

/** Where a drop into this column lands for this part, or an error message. */
function dropTarget(part: Part, column: Column): PartStatus | string {
  if (column.key === "prep") {
    if (part.method === "cnc") return "toolpaths";
    if (part.method === "print") return "slicing";
    return `${part.name} is ${methodMeta(part.method).label} — no prep stage`;
  }
  if (column.key === "finishing" && part.method !== "cnc") {
    return `Finishing is a CNC stage`;
  }
  const status = column.statuses[0];
  if (part.method && !methodMeta(part.method).lanes.includes(status) && status !== "rejected") {
    return `${methodMeta(part.method).label} parts skip ${column.title}`;
  }
  return status;
}

/** Live kanban board with per-method pipelines. */
export function KanbanBoard({ initialParts }: { initialParts: Part[] }) {
  const [parts, setParts] = useState(initialParts);
  const [view, setView] = useState<BoardView>("all");
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);

  useLiveTable({
    table: "parts",
    onChange: () => listParts(createClient()).then(setParts).catch(console.error),
  });

  const visible = view === "all" ? parts : parts.filter((p) => p.method === view);
  const columns = columnsFor(view);

  const movePart = async (partId: string, column: Column) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    const target = dropTarget(part, column);
    if (!["queued", "toolpaths", "slicing", "saw", "ready", "in_progress", "finishing", "done", "rejected"].includes(target)) {
      toast.error(target);
      return;
    }
    const status = target as PartStatus;
    if (part.status === status) return;

    // optimistic move; landing back in the queue releases the assignment
    setParts((ps) =>
      ps.map((p) =>
        p.id === partId
          ? {
              ...p,
              status,
              assigned_to: status === "queued" ? null : p.assigned_to,
              assignee: status === "queued" ? null : p.assignee,
            }
          : p,
      ),
    );

    try {
      if (status === "queued") await assignPartAction(partId, null);
      else await updateStatusAction(partId, status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move part");
      setParts((ps) => ps.map((p) => (p.id === partId ? part : p)));
    }
  };

  const archivePart = async (part: Part) => {
    setParts((ps) => ps.filter((p) => p.id !== part.id)); // optimistic
    try {
      await setArchivedAction(part.id, true);
      toast.success(`"${part.name}" archived`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive");
      setParts((ps) => [part, ...ps]);
    }
  };

  const deletePart = async (part: Part) => {
    setDeleteTarget(null);
    setParts((ps) => ps.filter((p) => p.id !== part.id)); // optimistic
    try {
      await deletePartAction(part.id);
      toast.success(`"${part.name}" deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      setParts((ps) => [part, ...ps]);
    }
  };

  const methodCount = (m: PartMethod) => parts.filter((p) => p.method === m).length;

  return (
    <div className="space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as BoardView)}>
        <TabsList>
          <TabsTrigger value="all" className="px-3">
            All <span className="ml-1 text-xs tabular-nums text-muted-foreground">{parts.length}</span>
          </TabsTrigger>
          {PART_METHODS.map((m) => (
            <TabsTrigger key={m.value} value={m.value} className="px-3">
              {m.label}
              <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                {methodCount(m.value)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="-m-1 flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 pb-2 lg:snap-none">
        {columns.map((col) => (
          <KanbanColumn
            key={col.key}
            title={col.title}
            parts={visible.filter((p) => col.statuses.includes(p.status as PartStatus))}
            showMethod={view === "all"}
            onDropPart={(id) => movePart(id, col)}
            onCardDragStart={(e, part) => {
              e.dataTransfer.setData("text/part-id", part.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onArchive={archivePart}
            onRequestDelete={setDeleteTarget}
          />
        ))}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              This removes the part and its file for good. Archive instead if you might need it
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteTarget && deletePart(deleteTarget)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
