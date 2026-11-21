/**
 * 2D verify figure (DXF): fit a profile into a fixed-size box, place the
 * "measure this" dimension line, size hole highlight rings. Pure; DXF
 * inches. 3D framing lives in figure-3d.ts and bore-view.ts.
 */

import type { BoundingBox, Point } from "@/types/geometry";

/**
 * Fit a CAD bbox into a W×H px figure with uniform px padding. Returns the
 * SVG viewBox in y-flipped space (CAD y-up drawn under scale(1,-1)) and the
 * world units per screen pixel.
 */
export function fitFigure(
  bbox: BoundingBox,
  size: { width: number; height: number },
  padPx: number,
): { viewBox: [number, number, number, number]; upp: number } {
  const w = Math.max(bbox.width, 1e-6);
  const h = Math.max(bbox.height, 1e-6);
  const innerW = Math.max(size.width - 2 * padPx, 1);
  const innerH = Math.max(size.height - 2 * padPx, 1);
  const upp = Math.max(w / innerW, h / innerH);
  const vw = size.width * upp;
  const vh = size.height * upp;
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  return { viewBox: [cx - vw / 2, -cy - vh / 2, vw, vh], upp };
}

/** share of the figure a focused span fills (both axes), and the least context around it */
export const FOCUS_FRACTION = 0.45;

/**
 * Zoom onto a short span a→b (two adjacent holes, or an edge and a hole) so
 * it fills ~FOCUS_FRACTION of the figure, centered on its midpoint, with at
 * least `minSpan` world units across. Never zooms out past the whole-part
 * fit (`fit`) — a long span just shows the whole part.
 */
export function focusFigure(
  a: Point,
  b: Point,
  size: { width: number; height: number },
  minSpan: number,
  fit: { viewBox: [number, number, number, number]; upp: number },
): { viewBox: [number, number, number, number]; upp: number } {
  const needW = Math.max(Math.abs(b.x - a.x) / FOCUS_FRACTION, minSpan);
  const needH = Math.max(Math.abs(b.y - a.y) / FOCUS_FRACTION, minSpan * (size.height / size.width));
  const upp = Math.max(needW / size.width, needH / size.height);
  if (upp >= fit.upp) return fit;
  const [vw, vh] = [size.width * upp, size.height * upp];
  const [cx, cy] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
  return { viewBox: [cx - vw / 2, -cy - vh / 2, vw, vh], upp };
}

/**
 * The datum edge as a segment: through the edge point `a`, perpendicular to
 * the edge→hole direction, spanning the part's bounding box.
 */
export function edgeLine2D(a: Point, b: Point, bbox: BoundingBox): [Point, Point] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const p = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const ts = [bbox.min, bbox.max, { x: bbox.min.x, y: bbox.max.y }, { x: bbox.max.x, y: bbox.min.y }].map(
    (c) => (c.x - a.x) * p.x + (c.y - a.y) * p.y,
  );
  const [lo, hi] = [Math.min(...ts), Math.max(...ts)];
  return [
    { x: a.x + p.x * lo, y: a.y + p.y * lo },
    { x: a.x + p.x * hi, y: a.y + p.y * hi },
  ];
}

export interface DimensionLine2D {
  /** ends of the dimension line (arrow tips) */
  a: Point;
  b: Point;
  /** extension lines from the part edge out past the dimension line */
  extA: [Point, Point];
  extB: [Point, Point];
  /** midpoint of the dimension line, for the value label */
  mid: Point;
  vertical: boolean;
}

/**
 * Dimension line for an overall extent, `offset` outside the profile: x runs
 * under the part (screen-below once y is flipped), y runs down its left side.
 * Extension lines overshoot the dimension line by `overshoot`.
 */
export function extentDimensionLine(
  bbox: BoundingBox,
  axis: "x" | "y",
  offset: number,
  overshoot: number,
): DimensionLine2D {
  if (axis === "x") {
    const y = bbox.min.y - offset;
    return {
      a: { x: bbox.min.x, y },
      b: { x: bbox.max.x, y },
      extA: [{ x: bbox.min.x, y: bbox.min.y }, { x: bbox.min.x, y: y - overshoot }],
      extB: [{ x: bbox.max.x, y: bbox.min.y }, { x: bbox.max.x, y: y - overshoot }],
      mid: { x: (bbox.min.x + bbox.max.x) / 2, y },
      vertical: false,
    };
  }
  const x = bbox.min.x - offset;
  return {
    a: { x, y: bbox.min.y },
    b: { x, y: bbox.max.y },
    extA: [{ x: bbox.min.x, y: bbox.min.y }, { x: x - overshoot, y: bbox.min.y }],
    extB: [{ x: bbox.min.x, y: bbox.max.y }, { x: x - overshoot, y: bbox.max.y }],
    mid: { x, y: (bbox.min.y + bbox.max.y) / 2 },
    vertical: true,
  };
}

/**
 * Tall profiles in a wide figure get a quarter turn (CCW) so they fill it —
 * a 7" × 4" plate is ~3× bigger on a phone that way. The part in hand has no
 * "up", so this costs nothing.
 */
export function shouldRotate(bbox: BoundingBox, size: { width: number; height: number }): boolean {
  return bbox.height > bbox.width * 1.1 && size.width > size.height;
}

/** CCW quarter turn, matching SVG `rotate(90)` inside the y-up group: (x, y) → (−y, x). */
export function rotatePoint(p: Point): Point {
  return { x: -p.y, y: p.x };
}

export function rotateBBox(b: BoundingBox): BoundingBox {
  return {
    min: { x: -b.max.y, y: b.min.x },
    max: { x: -b.min.y, y: b.max.x },
    width: b.height,
    height: b.width,
  };
}

/** Filled arrowhead triangle with its tip at `tip`, pointing away from `from`. */
export function arrowHead(from: Point, tip: Point, length: number, halfWidth: number): Point[] {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const base = { x: tip.x - ux * length, y: tip.y - uy * length };
  return [
    tip,
    { x: base.x - uy * halfWidth, y: base.y + ux * halfWidth },
    { x: base.x + uy * halfWidth, y: base.y - ux * halfWidth },
  ];
}

/** Highlight ring radius: a bit bigger than the hole, never smaller than `minPx` on screen. */
export function holeRingRadius(diameter: number, upp: number, minPx = 7): number {
  return Math.max((diameter / 2) * 1.25 + 2 * upp, minPx * upp);
}
