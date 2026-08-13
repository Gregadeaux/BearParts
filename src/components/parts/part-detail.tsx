"use client";

import { useEffect, useState } from "react";
import type { Part, ProfileRow } from "@/types/part";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { StlWorkspace } from "@/components/viewer/stl-workspace";
import { PartActions } from "./part-actions";
import { StatusBadge, PriorityBadge } from "./status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface Props {
  part: Part;
  team: ProfileRow[];
  userId: string;
  fileUrl: string;
}

/** Full part page: header info, actions, and the right viewer for the file type. */
export function PartDetail({ part, team, userId, fileUrl }: Props) {
  const isStl = part.file_type === "stl";
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [stlBuffer, setStlBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(fileUrl)
      .then((r) => {
        if (!r.ok) return Promise.reject();
        return isStl ? r.arrayBuffer().then(setStlBuffer) : r.text().then(setDxfText);
      })
      .catch(() => setError(true));
  }, [fileUrl, isStl]);

  const loaded = isStl ? stlBuffer : dxfText;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{part.name}</h1>
          <StatusBadge status={part.status as never} />
          <PriorityBadge priority={part.priority as never} />
          {isStl && <span className="text-xs text-muted-foreground">3D print</span>}
          {part.quantity > 1 && <span className="text-sm text-muted-foreground">×{part.quantity}</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {part.material && <span>{part.material} · </span>}
          {part.submitter?.display_name ?? "Unknown"} · {formatDate(part.created_at)}
        </p>
        {part.description && <p className="text-sm">{part.description}</p>}
      </div>

      <PartActions part={part} team={team} userId={userId} />

      {error ? (
        <p className="text-sm text-destructive">Could not load the part file.</p>
      ) : !loaded ? (
        <Skeleton className="h-72 w-full" />
      ) : isStl ? (
        <StlWorkspace stlBuffer={stlBuffer!} />
      ) : (
        <DxfWorkspace
          dxfText={dxfText!}
          unitOverride={part.units === "unknown" ? undefined : (part.units as never)}
        />
      )}

      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href={fileUrl} download={`${part.name}.${part.file_type}`} />}
      >
        Download {isStl ? "STL" : "DXF"}
      </Button>
    </div>
  );
}
