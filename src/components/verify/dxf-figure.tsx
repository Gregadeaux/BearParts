"use client";

import { useMemo, useRef } from "react";
import type { BoundingBox, NormalizedEntity, Point } from "@/types/geometry";
import type { KeyDimension } from "@/services/dimensions/key-dimensions";
import { entitiesToSvgPaths } from "@/services/dxf/render.service";
import {
  arrowHead,
  extentDimensionLine,
  fitFigure,
  holeRingRadius,
  rotateBBox,
  rotatePoint,
  shouldRotate,
} from "@/services/dimensions/figure";
import { useElementSize } from "./use-element-size";

/** room around the profile for the dimension line, px */
const PAD_PX = 22;
const pts = (ps: Point[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

interface Props {
  entities: NormalizedEntity[];
  bbox: BoundingBox;
  dim: KeyDimension;
}

/**
 * The real DXF profile with the thing to measure called out: a bold
 * dimension arrow for overall length/width, every hole of the group ringed
 * (everything else dimmed), or a dimmed profile for thickness. Never prints
 * a number — entry is blind.
 * Same y-flip convention as DxfViewer (CAD y-up under scale(1,-1)); tall
 * profiles are turned a quarter (rotate(90) in CAD space) to fill the figure.
 */
export function DxfFigure({ entities, bbox, dim }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref, { width: 340, height: 144 });
  const paths = useMemo(() => entitiesToSvgPaths(entities), [entities]);
  // tall parts turn a quarter so they fill the wide figure
  const turned = shouldRotate(bbox, size);
  const frame = turned ? rotateBBox(bbox) : bbox;
  const { viewBox, upp } = fitFigure(frame, size, PAD_PX);
  const feature = dim.feature;
  const axis = feature?.type === "extent" && (feature.axis === "x" || feature.axis === "y") ? feature.axis : null;
  // dimension lines live in the (possibly turned) frame; geometry is turned by the SVG transform
  const extent = axis
    ? extentDimensionLine(frame, turned ? (axis === "x" ? "y" : "x") : axis, 12 * upp, 4 * upp)
    : null;
  const holes = feature?.type === "holes" ? feature : null;

  return (
    <div ref={ref} className="relative h-full w-full">
      <svg
        viewBox={viewBox.join(" ")}
        className="h-full w-full"
        role="img"
        aria-label={`Part outline, ${dim.label} highlighted`}
      >
        <g transform="scale(1,-1)">
          <g
            className="text-foreground"
            opacity={extent ? 0.8 : 0.28}
            transform={turned ? "rotate(90)" : undefined}
          >
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25 * upp}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
          <g className="text-blue-600 dark:text-blue-400">
            {extent && (
              <>
                {[extent.extA, extent.extB].map(([p, q], i) => (
                  <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="currentColor" strokeWidth={1 * upp} />
                ))}
                <line
                  x1={extent.a.x}
                  y1={extent.a.y}
                  x2={extent.b.x}
                  y2={extent.b.y}
                  stroke="currentColor"
                  strokeWidth={2.25 * upp}
                />
                <polygon points={pts(arrowHead(extent.b, extent.a, 9 * upp, 4 * upp))} fill="currentColor" />
                <polygon points={pts(arrowHead(extent.a, extent.b, 9 * upp, 4 * upp))} fill="currentColor" />
              </>
            )}
            {holes?.centers.map((center, i) => {
              const c = turned ? rotatePoint(center) : center;
              const r = holeRingRadius(holes.diameter, upp);
              return (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r={r + 4 * upp} fill="currentColor" opacity={0.15} />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={r}
                    fill="currentColor"
                    fillOpacity={0.25}
                    stroke="currentColor"
                    strokeWidth={2 * upp}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      {dim.kind === "thickness" && (
        <span className="absolute bottom-1.5 left-2 rounded bg-card/90 px-1.5 text-xs text-muted-foreground">
          Stock thickness — measure the edge
        </span>
      )}
    </div>
  );
}
