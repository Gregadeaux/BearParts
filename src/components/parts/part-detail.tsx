"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { Part, ProfileRow } from "@/types/part";
import type { VersionDocumentRow } from "@/services/version-documents.service";
import { VersionDocsTabs } from "@/components/library/version-docs-tabs";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { StlWorkspace } from "@/components/viewer/stl-workspace";
import { PdfWorkspace } from "@/components/viewer/pdf-workspace";
import { StepWorkspace } from "@/components/viewer/step-workspace";
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
  /** drawings + G-code from the source library version (read-only here) */
  versionDocs?: VersionDocumentRow[];
}

/** Full part page: header info, actions, and the right viewer for the file type. */
export function PartDetail({ part, team, userId, fileUrl, versionDocs = [] }: Props) {
  const fileType = part.file_type as "dxf" | "stl" | "pdf" | "step";
  const isBinary = fileType !== "dxf";
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(fileUrl)
      .then((r) => {
        if (!r.ok) return Promise.reject();
        return isBinary ? r.arrayBuffer().then(setBuffer) : r.text().then(setDxfText);
      })
      .catch(() => setError(true));
  }, [fileUrl, isBinary]);

  const loaded = isBinary ? buffer : dxfText;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* the top bar already renders the part name as the page <h1> */}
          <h2 className="min-w-0 truncate text-lg font-semibold">{part.name}</h2>
          <StatusBadge status={part.status as never} />
          <PriorityBadge priority={part.priority as never} />
          {fileType === "stl" && <span className="text-xs text-muted-foreground">3D print</span>}
          {fileType === "pdf" && <span className="text-xs text-muted-foreground">drawing</span>}
          {fileType === "step" && <span className="text-xs text-muted-foreground">CAD model</span>}
          {part.quantity > 1 && <span className="text-xs text-muted-foreground">×{part.quantity}</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {part.material && <span>{part.material} · </span>}
          {part.submitter?.display_name ?? "Unknown"} · {formatDate(part.created_at)}
          {part.source_version?.library_part && (
            <>
              {" · from "}
              <Link
                href={`/library/parts/${part.source_version.library_part.id}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {part.source_version.library_part.name} v{part.source_version.version}
              </Link>
            </>
          )}
        </p>
        {part.description && <p className="text-sm">{part.description}</p>}
      </div>

      <PartActions part={part} team={team} userId={userId} />

      {error ? (
        <p className="rounded-lg border border-dashed border-destructive/40 px-3 py-8 text-center text-sm text-destructive">
          Could not load the part file. Try downloading it instead.
        </p>
      ) : (
        (() => {
          const viewer = !loaded ? (
            <Skeleton className="h-72 w-full" />
          ) : fileType === "stl" ? (
            <StlWorkspace stlBuffer={buffer!} />
          ) : fileType === "pdf" ? (
            <PdfWorkspace pdfBuffer={buffer!} />
          ) : fileType === "step" ? (
            <StepWorkspace stepBuffer={buffer!} />
          ) : (
            <DxfWorkspace
              dxfText={dxfText!}
              unitOverride={part.units === "unknown" ? undefined : (part.units as never)}
            />
          );
          // library versions can carry drawings + G-code — machinists get them here
          return versionDocs.length > 0 ? (
            <VersionDocsTabs initialDocs={versionDocs}>{viewer}</VersionDocsTabs>
          ) : (
            viewer
          );
        })()
      )}

      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href={fileUrl} download={`${part.name}.${part.file_type}`} />}
      >
        <Download /> Download {fileType.toUpperCase()}
      </Button>
    </div>
  );
}
