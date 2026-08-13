"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { parseStl } from "@/services/stl/stl-parser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// three.js is heavy — only load it when an STL is actually on screen
const StlViewer = dynamic(() => import("./stl-viewer").then((m) => m.StlViewer), {
  ssr: false,
  loading: () => <Skeleton className="h-[55svh] min-h-64 w-full lg:h-[70svh]" />,
});

/** 3D preview for STL parts. No machining analysis — printers don't care. */
export function StlWorkspace({ stlBuffer }: { stlBuffer: ArrayBuffer }) {
  const result = useMemo(() => {
    try {
      return { mesh: parseStl(stlBuffer), error: null };
    } catch (e) {
      return { mesh: null, error: e instanceof Error ? e.message : "Could not read this STL" };
    }
  }, [stlBuffer]);

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        {result.error}
      </div>
    );
  }
  const { boundingBox: bb, triangleCount } = result.mesh!;

  return (
    <div className="space-y-3">
      <StlViewer mesh={result.mesh!} className="h-[55svh] min-h-64 lg:h-[70svh]" />
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="tabular-nums">
          {fmt(bb.size.x)} × {fmt(bb.size.y)} × {fmt(bb.size.z)} (file units)
        </Badge>
        <Badge variant="outline" className="tabular-nums">
          {triangleCount.toLocaleString()} triangles
        </Badge>
      </div>
    </div>
  );
}

const fmt = (n: number) => parseFloat(n.toFixed(2));
