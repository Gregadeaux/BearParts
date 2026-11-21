"use client";

import dynamic from "next/dynamic";
import type { BoundingBox, NormalizedEntity } from "@/types/geometry";
import type { StlMesh } from "@/services/stl/stl-parser";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";
import { Skeleton } from "@/components/ui/skeleton";
import { DxfFigure } from "./dxf-figure";

// three.js only loads for STEP/STL parts
const ModelFigure = dynamic(() => import("./model-figure").then((m) => m.ModelFigure), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

/** What the page can draw the part from. */
export type FigureSource =
  | { kind: "dxf"; entities: NormalizedEntity[] | null; bbox: BoundingBox | null }
  | { kind: "model"; mesh: StlMesh | null; inchesPerUnit: number };

/**
 * Fixed-height picture of the part with the current dimension called out —
 * arrows and markers only, never the value (entry is blind). Same height on
 * every step (no layout jump); a skeleton until the geometry the page is
 * already loading arrives.
 */
export function DimensionFigure({ source, dim }: { source: FigureSource; dim: KeyDimension }) {
  const feature = dim.feature;
  let body: React.ReactNode = <Skeleton className="h-full w-full" />;
  if (source.kind === "dxf" && source.entities && source.bbox) {
    body = <DxfFigure entities={source.entities} bbox={source.bbox} dim={dim} />;
  } else if (source.kind === "model" && source.mesh) {
    body = <ModelFigure mesh={source.mesh} feature={feature} inchesPerUnit={source.inchesPerUnit} />;
  }
  const modelHint = source.kind === "model" && !feature && dim.kind === "thickness";
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-lg border bg-card sm:h-56">
      {body}
      {modelHint && (
        <span className="absolute bottom-1.5 left-2 rounded bg-card/90 px-1.5 text-xs text-muted-foreground">
          Stock thickness — measure a wall
        </span>
      )}
    </div>
  );
}
