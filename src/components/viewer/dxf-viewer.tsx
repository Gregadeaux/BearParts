"use client";

import { useMemo, useState } from "react";
import type { NormalizedEntity, Point } from "@/types/geometry";
import type { DxfAnalysis } from "@/types/analysis";
import { entitiesToSvgPaths } from "@/services/dxf/render.service";
import { snapToFeature, type SnapResult } from "@/services/dxf/snap.service";
import { usePanZoom } from "./use-pan-zoom";
import { HoleMarkers } from "./hole-markers";
import { HoleInfoChip } from "./hole-info-chip";
import { ViewerToolbar } from "./viewer-toolbar";
import { AnnotationPins, type ViewerAnnotation } from "./annotation-pins";

interface Props {
  entities: NormalizedEntity[];
  analysis: DxfAnalysis;
  className?: string;
  /** saved comment pins to render */
  annotations?: ViewerAnnotation[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string) => void;
  /** enables the annotate tool; called with the snapped point on tap */
  onAnnotate?: (snap: SnapResult) => void;
  /** in-progress pin location */
  draftAnnotation?: Point | null;
}

/** Interactive DXF viewer: pan, pinch-zoom, tappable hole markers, comment pins. */
export function DxfViewer({
  entities,
  analysis,
  className,
  annotations = [],
  selectedAnnotationId = null,
  onSelectAnnotation,
  onAnnotate,
  draftAnnotation,
}: Props) {
  const { svgRef, viewBox, handlers, unitsPerPx, clientToWorld, wasDrag, zoomIn, zoomOut, reset } =
    usePanZoom(analysis.boundingBox);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [annotating, setAnnotating] = useState(false);

  const paths = useMemo(() => entitiesToSvgPaths(entities), [entities]);
  const upp = unitsPerPx();

  const handleClick = (e: React.MouseEvent) => {
    if (wasDrag()) return;
    if (annotating && onAnnotate) {
      const world = clientToWorld(e.clientX, e.clientY);
      onAnnotate(snapToFeature(entities, analysis.holes, world, 14 * upp));
      setAnnotating(false);
      return;
    }
    setSelectedHole(null);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-card ${
        annotating ? "cursor-crosshair ring-2 ring-amber-500/60" : ""
      } ${className ?? ""}`}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="h-full w-full touch-none select-none"
        onClick={handleClick}
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
            onSelect={(i) => {
              if (annotating) return;
              setSelectedHole(i === selectedHole ? null : i);
            }}
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
        {(annotations.length > 0 || draftAnnotation) && (
          <AnnotationPins
            annotations={annotations}
            selectedId={selectedAnnotationId}
            onSelect={(id) => onSelectAnnotation?.(id)}
            unitsPerPx={upp}
            draft={draftAnnotation}
          />
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
        onToggleMarkers={() =>
          setShowMarkers((v) => {
            if (!v) setAnnotating(false); // markers on → annotate off
            return !v;
          })
        }
        annotating={onAnnotate ? annotating : undefined}
        onToggleAnnotate={
          onAnnotate
            ? () =>
                setAnnotating((v) => {
                  if (!v) setShowMarkers(false); // annotate on → markers off
                  return !v;
                })
            : undefined
        }
      />

      {annotating && (
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border bg-background/95 px-3 py-1 text-xs shadow backdrop-blur">
          Tap a hole, corner, or spot to pin a comment
        </p>
      )}

      {!annotating && selectedHole !== null && analysis.holes[selectedHole] && (
        <HoleInfoChip hole={analysis.holes[selectedHole]} onClose={() => setSelectedHole(null)} />
      )}
    </div>
  );
}
