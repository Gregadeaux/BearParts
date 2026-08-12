"use client";

import { useEffect, useState } from "react";
import type { Part, ProfileRow } from "@/types/part";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { PartActions } from "./part-actions";
import { StatusBadge, PriorityBadge } from "./status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface Props {
  part: Part;
  team: ProfileRow[];
  userId: string;
  dxfUrl: string;
}

/** Full part page: header info, actions, viewer. DXF text is fetched client-side. */
export function PartDetail({ part, team, userId, dxfUrl }: Props) {
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(dxfUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then(setDxfText)
      .catch(() => setError(true));
  }, [dxfUrl]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{part.name}</h1>
          <StatusBadge status={part.status as never} />
          <PriorityBadge priority={part.priority as never} />
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
        <p className="text-sm text-destructive">Could not load the DXF file.</p>
      ) : dxfText ? (
        <DxfWorkspace dxfText={dxfText} unitOverride={part.units === "unknown" ? undefined : (part.units as never)} />
      ) : (
        <Skeleton className="h-72 w-full" />
      )}

      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href={dxfUrl} download={`${part.name}.dxf`} />}
      >
        Download DXF
      </Button>
    </div>
  );
}
