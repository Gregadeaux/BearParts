"use client";

import { useEffect, useMemo, useState } from "react";
import type { Units } from "@/types/analysis";
import { analyzeDxfText, type AnalyzedDxf } from "@/services/dxf/analysis.service";
import { DxfViewer } from "./dxf-viewer";
import { AnalysisPanel } from "./analysis-panel";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** raw DXF text — parsed & analyzed client-side */
  dxfText: string;
  unitOverride?: Units;
  onAnalyzed?: (result: AnalyzedDxf) => void;
}

/** Viewer + analysis side by side (stacked on phones). */
export function DxfWorkspace({ dxfText, unitOverride, onAnalyzed }: Props) {
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    try {
      setError(null);
      return analyzeDxfText(dxfText, unitOverride);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this DXF");
      return null;
    }
  }, [dxfText, unitOverride]);

  useEffect(() => {
    if (result && onAnalyzed) onAnalyzed(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!result) return <Skeleton className="h-72 w-full" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <DxfViewer
        entities={result.entities}
        analysis={result.analysis}
        className="h-[55svh] min-h-64 lg:h-[60svh]"
      />
      <AnalysisPanel analysis={result.analysis} />
    </div>
  );
}
