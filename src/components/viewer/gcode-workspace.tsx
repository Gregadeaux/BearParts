"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { parseGcode } from "@/services/gcode/gcode-parser";
import { Skeleton } from "@/components/ui/skeleton";

const GcodeViewer = dynamic(() => import("./gcode-viewer").then((m) => m.GcodeViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[60svh]" />,
});

/** Toolpath preview for a G-code file, with cut/rapid stats. */
export function GcodeWorkspace({ gcodeText }: { gcodeText: string }) {
  const result = useMemo(() => {
    try {
      return { toolpath: parseGcode(gcodeText), error: null };
    } catch (e) {
      return { toolpath: null, error: e instanceof Error ? e.message : "Could not read this file" };
    }
  }, [gcodeText]);

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        {result.error}
      </div>
    );
  }
  const tp = result.toolpath!;
  const { size } = tp.boundingBox;
  const unit = tp.inches ? '"' : " mm";

  return (
    <div className="space-y-2">
      <GcodeViewer toolpath={tp} className="h-[55svh] min-h-64 lg:h-[60svh]" />
      <p className="text-xs text-muted-foreground">
        {tp.segments.filter((s) => !s.rapid).length.toLocaleString()} cutting moves · envelope{" "}
        {size.x.toFixed(2)}×{size.y.toFixed(2)}×{size.z.toFixed(2)}
        {unit}
      </p>
    </div>
  );
}
