"use client";

import { useState } from "react";
import type { Part } from "@/types/part";
import { Badge } from "@/components/ui/badge";
import { KanbanCard } from "./kanban-card";

interface Props {
  title: string;
  parts: Part[];
  onDropPart?: (partId: string) => void;
  onCardDragStart?: (e: React.DragEvent, part: Part) => void;
}

/** One status lane. Accepts card drops (desktop drag-and-drop). */
export function KanbanColumn({ title, parts, onDropPart, onCardDragStart }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`flex w-[78vw] shrink-0 snap-start flex-col rounded-lg bg-muted/70 dark:bg-muted/50 sm:w-64 lg:w-auto lg:min-w-0 lg:flex-1 ${
        over ? "ring-2 ring-primary/50" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/part-id");
        if (id && onDropPart) onDropPart(id);
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="secondary" className="tabular-nums">
          {parts.length}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {parts.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Empty</p>
        ) : (
          parts.map((p) => (
            <KanbanCard
              key={p.id}
              part={p}
              onDragStart={onCardDragStart ? (e) => onCardDragStart(e, p) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
