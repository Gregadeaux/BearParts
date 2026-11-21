"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { Part, ProfileRow } from "@/types/part";
import type { Units } from "@/types/analysis";
import type { AnalyzedDxf } from "@/services/dxf/analysis.service";
import type { StlMesh } from "@/services/stl/stl-parser";
import type { DrawingSource } from "@/types/drawing";
import type { PartVerification } from "@/types/verification";
import type { VersionDocumentRow } from "@/services/version-documents.service";
import { DrawingButton } from "@/components/drawing/drawing-button";
import { VerifyButton } from "@/components/verify/verify-button";
import { VerificationBadge } from "@/components/verify/verification-badge";
import { VerificationHistory } from "@/components/verify/verification-history";
import { ThicknessField } from "./thickness-field";
import { PageBreadcrumb, type Crumb } from "@/components/layout/page-breadcrumb";
import { VersionDocsTabs } from "@/components/library/version-docs-tabs";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { StlWorkspace } from "@/components/viewer/stl-workspace";
import { PdfWorkspace } from "@/components/viewer/pdf-workspace";
import { StepWorkspace } from "@/components/viewer/step-workspace";
import { PartActions } from "./part-actions";
import { MethodBadge, StatusBadge, PriorityBadge } from "./status-badge";
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
  /** navigation trail back to the board or the source library part */
  crumbs?: Crumb[];
  /** measurement checks, newest first */
  verifications?: PartVerification[];
}

/** Full part page: header info, actions, and the right viewer for the file type. */
export function PartDetail({
  part,
  team,
  userId,
  fileUrl,
  versionDocs = [],
  crumbs = [],
  verifications = [],
}: Props) {
  const fileType = part.file_type as "dxf" | "stl" | "pdf" | "step";
  const isBinary = fileType !== "dxf";
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState(false);
  // the viewers' parses, shared with Verify (profile / mesh for its figure) — never re-parsed
  const [dxf, setDxf] = useState<AnalyzedDxf | null>(null);
  const [mesh, setMesh] = useState<StlMesh | null>(null);
  const liveAnalysis = dxf?.analysis ?? null;

  const drawingSource: DrawingSource = {
    name: part.name,
    filePath: part.file_path,
    fileType,
    units: part.units as Units,
    analysis: part.analysis ?? liveAnalysis,
    material: part.material,
    thicknessIn: part.thickness_in ?? null,
    quantity: part.quantity,
    drafter: part.submitter?.display_name ?? null,
    revision: part.source_version ? `v${part.source_version.version}` : null,
  };

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
      <PageBreadcrumb crumbs={crumbs} />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* the top bar already renders the part name as the page <h1> */}
          <h2 className="min-w-0 truncate text-lg font-semibold">{part.name}</h2>
          <StatusBadge status={part.status as never} />
          <MethodBadge method={part.method} />
          <PriorityBadge priority={part.priority as never} />
          <VerificationBadge result={part.verification_result} />
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
        <ThicknessField partId={part.id} thicknessIn={part.thickness_in} />
      </div>

      <PartActions part={part} team={team} userId={userId} />

      <div className="flex flex-wrap items-center gap-2">
        <VerifyButton part={part} dxf={dxf} mesh={mesh} fileError={error} />
        <DrawingButton source={drawingSource} />
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-destructive/40 px-3 py-8 text-center text-sm text-destructive">
          Could not load the part file. Try downloading it instead.
        </p>
      ) : (
        (() => {
          const viewer = !loaded ? (
            <Skeleton className="h-72 w-full" />
          ) : fileType === "stl" ? (
            <StlWorkspace stlBuffer={buffer!} onMesh={setMesh} />
          ) : fileType === "pdf" ? (
            <PdfWorkspace pdfBuffer={buffer!} />
          ) : fileType === "step" ? (
            <StepWorkspace stepBuffer={buffer!} onMesh={setMesh} />
          ) : (
            <DxfWorkspace
              dxfText={dxfText!}
              unitOverride={part.units === "unknown" ? undefined : (part.units as never)}
              thicknessIn={part.thickness_in}
              onAnalyzed={setDxf}
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

      <VerificationHistory verifications={verifications} />
    </div>
  );
}
