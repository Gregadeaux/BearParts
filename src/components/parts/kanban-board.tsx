"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Part, PartStatus } from "@/types/part";
import { createClient } from "@/lib/supabase/client";
import { listParts } from "@/services/parts.service";
import { assignPartAction, updateStatusAction } from "@/app/actions/parts";
import { KanbanColumn } from "./kanban-column";

const COLUMNS: { key: PartStatus; title: string; statuses: PartStatus[] }[] = [
  { key: "queued", title: "Queue", statuses: ["queued"] },
  { key: "assigned", title: "Assigned", statuses: ["assigned"] },
  { key: "in_progress", title: "In progress", statuses: ["in_progress"] },
  { key: "done", title: "Done", statuses: ["done", "rejected"] },
];

/** Live kanban board. Drag cards between lanes on desktop; tap through on mobile. */
export function KanbanBoard({ initialParts, userId }: { initialParts: Part[]; userId: string }) {
  const [parts, setParts] = useState(initialParts);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("parts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, () => {
        listParts(supabase).then(setParts).catch(console.error);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const movePart = async (partId: string, column: PartStatus) => {
    const part = parts.find((p) => p.id === partId);
    if (!part || part.status === column) return;

    // optimistic move
    setParts((ps) =>
      ps.map((p) =>
        p.id === partId
          ? {
              ...p,
              status: column,
              assigned_to: column === "queued" ? null : p.assigned_to,
              assignee: column === "queued" ? null : p.assignee,
            }
          : p,
      ),
    );

    try {
      if (column === "queued") {
        await assignPartAction(partId, null); // back to the pool
      } else if (column === "assigned" && !part.assigned_to) {
        await assignPartAction(partId, userId); // dragging an unowned card here claims it
        toast.success("Claimed");
      } else {
        await updateStatusAction(partId, column);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move part");
      setParts((ps) => ps.map((p) => (p.id === partId ? part : p))); // roll back
    }
  };

  return (
    <div className="-m-1 flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 pb-2 lg:snap-none">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.key}
          title={col.title}
          parts={parts.filter((p) => col.statuses.includes(p.status as PartStatus))}
          onDropPart={(id) => movePart(id, col.key)}
          onCardDragStart={(e, part) => {
            e.dataTransfer.setData("text/part-id", part.id);
            e.dataTransfer.effectAllowed = "move";
          }}
        />
      ))}
    </div>
  );
}
