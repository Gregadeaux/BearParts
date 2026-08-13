"use client";

import Link from "next/link";
import type { Part } from "@/types/part";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "./status-badge";
import { formatDate, formatInches, initials } from "@/lib/format";

interface Props {
  part: Part;
  onDragStart?: (e: React.DragEvent) => void;
}

/** One kanban card. Assignee's profile circle sits on the top-right corner. */
export function KanbanCard({ part, onDragStart }: Props) {
  const bb = part.analysis?.boundingBox;
  return (
    <div className="relative" draggable={Boolean(onDragStart)} onDragStart={onDragStart}>
      <Link href={`/parts/${part.id}`} className="block" draggable={false}>
        <Card className="gap-1.5 border-border/80 p-3 shadow-sm transition-all hover:bg-accent/50 hover:shadow-md">
          <div className="flex items-start gap-2">
            <span className={`min-w-0 flex-1 truncate text-sm font-medium ${part.assignee ? "pr-7" : ""}`}>
              {part.name}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {part.file_type === "stl" && <span className="font-medium">3DP</span>}
            {part.quantity > 1 && <span>×{part.quantity}</span>}
            {part.material && <span className="truncate">{part.material}</span>}
            {bb && (
              <span className="tabular-nums">
                {formatInches(bb.width)} × {formatInches(bb.height)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <PriorityBadge priority={part.priority as never} />
            {part.status === "rejected" && <StatusBadge status="rejected" />}
            <span className="ml-auto text-xs text-muted-foreground">{formatDate(part.created_at)}</span>
          </div>
        </Card>
      </Link>

      {part.assignee && (
        <Avatar
          className="pointer-events-none absolute right-2.5 top-2.5 size-6"
          title={part.assignee.display_name}
        >
          {part.assignee.avatar_url && (
            <AvatarImage
              src={part.assignee.avatar_url}
              alt={part.assignee.display_name}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="text-[10px]">
            {initials(part.assignee.display_name)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
