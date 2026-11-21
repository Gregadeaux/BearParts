import type { AnalyzedHole } from "@/types/analysis";
import type { BoundingBox, Point } from "@/types/geometry";
import type { Layer } from "./canvas";
import { DIM, linearDim, ordinateDim } from "./dims";
import type { DxfPlan } from "./dxf-plan";
import { ORD_GAP } from "./dxf-plan";
import { extremeAlong, toPaper, type ViewXform } from "./dxf-view";
import { fmtIn, fmtOrdinate } from "./format";
import { spreadLabels } from "./layout-math";
import { pt, type Pt } from "./primitives";

/**
 * Should the overall size along an axis be given as a far-edge ordinate
 * instead of a linear dimension above/right of the view? Yes when the
 * outline barely reaches that side (a gusset's hypotenuse), which would
 * otherwise need extension lines spanning the whole part. `outline` is in
 * model inches.
 */
export function overallAsOrdinates(outline: Pt[][], bbox: BoundingBox): { x: boolean; y: boolean } {
  const { min, max, width: W, height: H } = bbox;
  const topL = extremeAlong(outline, "x", min.x, "max") ?? max.y;
  const topR = extremeAlong(outline, "x", max.x, "max") ?? max.y;
  const rightB = extremeAlong(outline, "y", min.y, "max") ?? max.x;
  const rightT = extremeAlong(outline, "y", max.y, "max") ?? max.x;
  return {
    x: 2 * max.y - topL - topR > 0.4 * H,
    y: 2 * max.x - rightB - rightT > 0.4 * W,
  };
}

/**
 * Overall width (above the view) and height (right of it). Extension lines
 * start at the outline where it actually reaches each extreme.
 */
export function drawOverallDims(
  layer: Layer,
  polys: Pt[][],
  v: ViewXform,
  bbox: BoundingBox,
  show: { width: boolean; height: boolean },
) {
  const x0 = v.ox;
  const y0 = v.oy;
  const x1 = v.ox + bbox.width * v.scale;
  const y1 = v.oy + bbox.height * v.scale;
  if (show.width) {
    const topL = extremeAlong(polys, "x", x0, "max") ?? y1;
    const topR = extremeAlong(polys, "x", x1, "max") ?? y1;
    linearDim(layer, pt(x0, topL), pt(x1, topR), "h", y1 + DIM.offset, fmtIn(bbox.width));
  }
  if (show.height) {
    const rightB = extremeAlong(polys, "y", y0, "max") ?? x1;
    const rightT = extremeAlong(polys, "y", y1, "max") ?? x1;
    linearDim(layer, pt(rightB, y0), pt(rightT, y1), "v", x1 + DIM.offset, fmtIn(bbox.height));
  }
}

/**
 * Ordinate dimensions from the lower-left datum: X values below the view,
 * Y values to its left. Each extension line starts at the feature nearest
 * that edge; crowded labels are spread apart with jogged extension lines.
 */
export function drawOrdinates(
  layer: Layer,
  plan: DxfPlan,
  polys: Pt[][],
  v: ViewXform,
  holes: AnalyzedHole[],
  points: Point[],
) {
  const s = v.scale;
  const gap = DIM.extGap;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.0006;

  if (plan.xs.length > 0) {
    const span = extent(v, "x", polys);
    const desired = plan.xs.map((x) => v.ox + x * s);
    const placed = spreadLabels(desired, ORD_GAP, v.ox - 0.25, v.ox + span + 0.25) ?? desired;
    plan.xs.forEach((x, i) => {
      const px = desired[i];
      const starts: number[] = [];
      if (x === 0 || Math.abs(x * s - span) < 0.001) starts.push((extremeAlong(polys, "x", px, "min") ?? v.oy) - gap);
      for (const h of holes) {
        if (near(h.center.x - v.minX, x)) starts.push(toPaper(v, h.center).y - (h.diameter / 2) * s - gap);
      }
      for (const p of points) if (near(p.x - v.minX, x)) starts.push(toPaper(v, p).y - gap);
      const from = pt(px, starts.length ? Math.min(...starts) : v.oy - gap);
      ordinateDim(layer, "x", from, v.oy, placed[i], fmtOrdinate(x));
    });
  }

  if (plan.ys.length > 0) {
    const span = extent(v, "y", polys);
    const desired = plan.ys.map((y) => v.oy + y * s);
    const placed = spreadLabels(desired, ORD_GAP, v.oy - 0.25, v.oy + span + 0.25) ?? desired;
    plan.ys.forEach((y, i) => {
      const py = desired[i];
      const starts: number[] = [];
      if (y === 0 || Math.abs(y * s - span) < 0.001) starts.push((extremeAlong(polys, "y", py, "min") ?? v.ox) - gap);
      for (const h of holes) {
        if (near(h.center.y - v.minY, y)) starts.push(toPaper(v, h.center).x - (h.diameter / 2) * s - gap);
      }
      for (const p of points) if (near(p.y - v.minY, y)) starts.push(toPaper(v, p).x - gap);
      const from = pt(starts.length ? Math.min(...starts) : v.ox - gap, py);
      ordinateDim(layer, "y", from, v.ox, placed[i], fmtOrdinate(y));
    });
  }
}

/** Remaining span of the outline beyond the largest ordinate (room to spread into). */
function extent(v: ViewXform, axis: "x" | "y", polys: Pt[][]): number {
  let max = -Infinity;
  for (const poly of polys) for (const p of poly) max = Math.max(max, axis === "x" ? p.x : p.y);
  const origin = axis === "x" ? v.ox : v.oy;
  return Number.isFinite(max) ? Math.max(0, max - origin) : 0;
}
