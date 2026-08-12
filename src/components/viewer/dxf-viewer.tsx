"use client";

import { useMemo, useState } from "react";
import type { NormalizedEntity } from "@/types/geometry";
import type { DxfAnalysis } from "@/types/analysis";
import { entitiesToSvgPaths } from "@/services/dxf/render.service";
import { usePanZoom } from "./use-pan-zoom";
import { HoleMarkers } from "./hole-markers";
import { HoleInfoChip } from "./hole-info-chip";
import { ViewerToolbar } from "./viewer-toolbar";

interface Props {
  entities: NormalizedEntity[];
  analysis: DxfAnalysis;
  className?: string;
}

/** Interactive DXF viewer: pan, pinch-zoom, tappable hole markers. */
export function DxfViewer({ entities, analysis, className }: Props) {
  const { svgRef, viewBox, handlers, unitsPerPx, wasDrag, zoomIn, zoomOut, reset } =
    usePanZoom(analysis.boundingBox);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);

  const paths = useMemo(() => entitiesToSvgPaths(entities), [entities]);
  const upp = unitsPerPx();

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-card ${className ?? ""}`}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="h-full w-full touch-none select-none"
        onClick={() => {
          if (!wasDrag()) setSelectedHole(null);
        }}
        {...handlers}
      >
        {/* geometry is CAD y-up; flip it here */}
        <g transform="scale(1,-1)">
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5 * upp}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
        {showMarkers && (
          <HoleMarkers
            holes={analysis.holes}
            selectedIndex={selectedHole}
            onSelect={(i) => setSelectedHole(i === selectedHole ? null : i)}
            unitsPerPx={upp}
          />
        )}
        {showMarkers &&
          analysis.pockets.flatMap((p, pi) =>
            p.sharpCorners.map((c, ci) => (
              <g key={`${pi}-${ci}`} transform={`translate(${c.x} ${-c.y})`}>
                <circle r={6 * upp} fill="none" stroke="#f97316" strokeWidth={1.5 * upp} strokeDasharray={`${3 * upp} ${2 * upp}`} />
              </g>
            )),
          )}
      </svg>

      <ViewerToolbar
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={() => {
          reset();
          setSelectedHole(null);
        }}
        markersVisible={showMarkers}
        onToggleMarkers={() => setShowMarkers((v) => !v)}
      />

      {selectedHole !== null && analysis.holes[selectedHole] && (
        <HoleInfoChip hole={analysis.holes[selectedHole]} onClose={() => setSelectedHole(null)} />
      )}
    </div>
  );
}
